import asyncio
import json
import traceback
from fastapi import APIRouter, HTTPException, Depends , Query, Response, status
from sqlalchemy.orm import Session,aliased
from ..schemas.register_schema import UserCreate
from ..schemas.login_schema import UserLogin
from ..schemas.new_ride_schema import RideCreate
from ..services import register_service
from ..services import login_service
from uuid import UUID
from sqlalchemy import text
from ..services.new_ride_service import create_ride 
from fastapi.responses import JSONResponse
from typing import List, Optional, Annotated
from datetime import datetime, timedelta, timezone
from ..schemas.user_rides_schema import RideSchema, RideStatus
from ..services.user_rides_service import get_future_rides, get_past_rides , get_all_rides
from ..utils.database import get_db
from src.models import ride_model, vehicle_model
import logging
from ..utils.database import get_db
from ..services.register_service import get_departments 
from ..schemas.notification_schema import NotificationOut
from ..services.user_notification import get_user_notifications ,send_notification_async
from fastapi import status as fastapi_status
from fastapi.security import OAuth2PasswordBearer
from ..utils.auth import role_check,identity_check,get_current_user,hash_password
from src.schemas.ride_status_enum import UpdateRideStatusRequest
from ..schemas.order_card_item import OrderCardItem
from ..models.ride_model import Ride
from ..services.user_edit_ride import patch_order_in_db
from ..services.user_rides_service import get_ride_by_id , get_archived_rides , cancel_order_in_db
from ..services.user_notification import create_system_notification,get_supervisor_id,get_user_name
import traceback
from ..utils.auth import get_current_user
from ..models.user_model import User
from ..services.user_form import process_completion_form
from ..schemas.form_schema import CompletionFormData
from ..utils.socket_manager import sio  # ✅ import this
from ..utils.socket_utils import convert_decimal
# from ..utils.email_utils import send_email
from ..services.auth_service import create_reset_token,verify_reset_token
from ..schemas.reset_password import ResetPasswordInput,ForgotPasswordRequest
from ..services.user_data import get_user_department
from ..models.vehicle_model import Vehicle
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
from ..models.ride_model import PendingRideSchema
from ..utils.scheduler import schedule_ride_start
from apscheduler.jobstores.base import JobLookupError
from ..utils.scheduler import scheduler
from ..services.city_service import get_cities,get_city, calculate_distance
from ..models.city_model import City
from sqlalchemy import cast
from ..services.user_form import get_ride_needing_feedback
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from src.schemas.department_schema import DepartmentOut
from src.models.department_model import Department
from ..utils.time_utils import is_time_in_blocked_window
from ..schemas.new_ride_schema import RideResponse
from ..services.ride_reminder_service import schedule_ride_reminder_email
from ..services.email_clean_service import EmailService

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from dotenv import load_dotenv
import os
import socketio

load_dotenv()  # Load environment variables  .env
FROM_CITY = os.getenv("FROM_CITY")
FROM_CITY_NAME = os.getenv("FROM_CITY", "Unknown City")
# BOOKIT_URL = os.getenv("BOOKIT_FRONTEND_URL", "http://localhost:4200")  

async def get_email_service(
    sio_server: Annotated[socketio.AsyncServer, Depends(lambda: sio)] # 'sio' is imported from ..utils.socket_manager
) -> EmailService:
    """
    Dependency injector for EmailService.
    Ensures EmailService is initialized with the correct Socket.IO server instance.
    """
    return EmailService(sio_server=sio_server)


router = APIRouter()


@router.post("/api/register")
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    try:
        logger.info(f"Registration attempt for user: {user.username}")
        return register_service.create_user(user, db)
    except ValueError as ve:
        logger.warning(f"Registration validation error: {str(ve)}")
        raise HTTPException(
            status_code=fastapi_status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        # Log the full traceback for debugging
        logger.error(f"Registration failed with error: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=fastapi_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"  # Return the actual error for debugging
        )
    



        
@router.post("/api/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    try:
        return login_service.login_user(user.username, user.password, db)
    except Exception as e:
        logger.error(f"Login failed: {str(e)}")
        raise HTTPException(
            status_code=fastapi_status.HTTP_401_UNAUTHORIZED,
            detail="Login failed: Incorrect username or password."  # Hide internal errors for security
        )
    



@router.get("/api/future-orders/{user_id}", response_model=List[RideSchema])
def get_future_orders(user_id: UUID, status: Optional[RideStatus] = Query(None),
                      from_date: Optional[datetime] = Query(None),
                      to_date: Optional[datetime] = Query(None),
                      db: Session = Depends(get_db),
                      token: str = Depends(oauth2_scheme),
                      ):

    try:
        role_check(allowed_roles=["employee", "admin"], token=token)
        identity_check(user_id=str(user_id), token=token)

        rides = get_future_rides(user_id, db, status, from_date, to_date)
        if not rides:
            if status or from_date or to_date:
                return JSONResponse(status_code=200, content={"message": "No rides match the given filters."})
            return JSONResponse(status_code=200, content={"message": "No future rides found."})

        return rides

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")


@router.get("/api/past-orders/{user_id}", response_model=List[RideSchema])
def get_past_orders(user_id: UUID, status: Optional[RideStatus] = Query(None),
                    from_date: Optional[datetime] = Query(None),
                    to_date: Optional[datetime] = Query(None),
                    db: Session = Depends(get_db),
                    token: str = Depends(oauth2_scheme)):

    role_check(["employee", "admin"], token)
    identity_check(str(user_id), token)

    rides = get_past_rides(user_id, db, status, from_date, to_date)

    if not rides:
        if status or from_date or to_date:
            return JSONResponse(status_code=200, content={"message": "אין הזמנות שמתאימות לסינון"})
        return JSONResponse(status_code=200, content={"message": "לא נמצאו הזמנות"})

    return rides



@router.get("/api/all-orders/{user_id}", response_model=List[RideSchema])
def get_all_orders(user_id: UUID, status: Optional[RideStatus] = Query(None),
                   from_date: Optional[datetime] = Query(None),
                   to_date: Optional[datetime] = Query(None),
                   db: Session = Depends(get_db),
                   token: str = Depends(oauth2_scheme)):

    role_check(["employee", "admin"], token)
    identity_check(str(user_id), token)

    rides = get_all_rides(user_id, db, status, from_date, to_date)
    return rides

    
@router.get("/api/user-orders/{user_id}/{order_id}")
def get_user_2specific_order():
    # Implementation pending
    return {"message": "Not implemented yet"}

@router.post("/api/orders/{user_id}", status_code=fastapi_status.HTTP_201_CREATED)
async def create_order(
    user_id: UUID,
    ride_request: RideCreate,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    role_check(allowed_roles=["employee", "admin"], token=token)
    identity_check(user_id=str(user_id), token=token)

    try:
        # Create the ride first - this is the critical, core action.
        new_ride = await create_ride(db, user_id, ride_request)
        
        # Schedule other tasks
        schedule_ride_start(new_ride.id, new_ride.start_datetime)
        schedule_ride_reminder_email(new_ride.id, new_ride.start_datetime)
        warning_flag = is_time_in_blocked_window(new_ride.start_datetime)
        department_id = get_user_department(user_id=user_id, db=db)

        # Emit the new ride request via Socket.IO immediately after creation.
        await sio.emit("new_ride_request", {
            "ride_id": str(new_ride.id),
            "user_id": str(user_id),
            "employee_name": new_ride.username,
            "status": new_ride.status,
            "destination": new_ride.stop,
            "end_datetime": str(new_ride.end_datetime),
            "date_and_time": str(new_ride.start_datetime),
            "vehicle_id": str(new_ride.vehicle_id),
            "requested_vehicle_plate": new_ride.plate_number,
            "department_id": str(department_id),
            "distance": new_ride.estimated_distance_km,
        })
        
        # Launch the email task in the background using a fire-and-forget pattern.
        # Do NOT await this call.
        supervisor_id = get_supervisor_id(user_id, db)
        if supervisor_id:
            employee_name = get_user_name(db, new_ride.user_id)
            supervisor_name = get_user_name(db, supervisor_id)
            
            # Instantiate EmailService for this request
            email_service = EmailService(sio_server=sio)
            
            destination_city = db.query(City).filter(City.id == new_ride.stop).first()
            destination_name = destination_city.name if destination_city else str(new_ride.stop)
            
            ride_details_for_email = {
                "username": employee_name,
                "ride_id": str(new_ride.id),
                "supervisor_name": supervisor_name,
                "start_location": new_ride.start_location,
                "destination": destination_name,
                "start_datetime": new_ride.start_datetime,
                "end_datetime": new_ride.end_datetime,
                "plate_number": new_ride.plate_number,
                "ride_type": new_ride.ride_type,
                "estimated_distance_km": new_ride.estimated_distance_km,
                "status": new_ride.status
            }

            # Use asyncio.create_task to send the email in the background.
            # The function will return immediately. The email sending and retries will happen in the background.
            asyncio.create_task(
                email_service.send_ride_creation_email(
                    ride_id=new_ride.id,
                    recipient_id=supervisor_id,
                    db=db,
                    ride_details=ride_details_for_email,
                    email_type="new_ride_request_to_supervisor",
                    use_retries=True # Use retries for this critical background task
                )
            )
            
            # The supervisor notification logic can stay here as it is not blocking
            supervisor_notification = create_system_notification(
                user_id=supervisor_id,
                title="בקשת נסיעה חדשה",
                message=f"שלח בקשה חדשה {employee_name} העובד",
                order_id=new_ride.id
            )
            await sio.emit("new_notification", {
                "id": str(supervisor_notification.id),
                "user_id": str(supervisor_notification.user_id),
                "title": supervisor_notification.title,
                "message": supervisor_notification.message,
                "notification_type": supervisor_notification.notification_type.value,
                "sent_at": supervisor_notification.sent_at.isoformat(),
                "order_id": str(supervisor_notification.order_id) if supervisor_notification.order_id else None,
                "order_status": new_ride.status
            })
            
        else:
            logger.warning(f"No supervisor found for user ID {user_id} — skipping supervisor notification and email.")
            
        # Create and send confirmation notification to the user
        confirmation = create_system_notification(
            user_id=new_ride.user_id,
            title="שליחת בקשה",
            message="בקשתך נשלחה בהצלחה",
            order_id=new_ride.id
        )
        await sio.emit("new_notification", {
            "id": str(confirmation.id),
            "user_id": str(confirmation.user_id),
            "title": confirmation.title,
            "message": confirmation.message,
            "notification_type": confirmation.notification_type.value,
            "sent_at": confirmation.sent_at.isoformat(),
            "order_id": str(confirmation.order_id) if confirmation.order_id else None,
            "order_status": new_ride.status
        })

        # Return the response immediately after creating the ride.
        # The email status is no longer needed in the response.
        return {
            **RideResponse.model_validate(new_ride).dict(),
            "inspector_warning": warning_flag,
        }

    except Exception as e:
        logger.error(f"Order creation failed: {str(e)}")
        raise HTTPException(
            status_code=fastapi_status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create order: {str(e)}"
        )
# async def create_order(
#     user_id: UUID,
#     ride_request: RideCreate,
#     db: Session = Depends(get_db),
#     token: str = Depends(oauth2_scheme)
# ):
#     role_check(allowed_roles=["employee", "admin"], token=token)
#     identity_check(user_id=str(user_id), token=token)

#     try:
#         # Instantiate EmailService for this request
#         email_service = EmailService(sio_server=sio)

#         email_status_output = {
#             "email_status": EmailStatusEnum.PENDING,
#             "email_message": "Email processing started",
#             "email_timestamp": datetime.now(timezone.utc).isoformat()
#         }

#         new_ride = await create_ride(db, user_id, ride_request)
#         schedule_ride_start(new_ride.id, new_ride.start_datetime)
#         schedule_ride_reminder_email(new_ride.id, new_ride.start_datetime)
#         warning_flag = is_time_in_blocked_window(new_ride.start_datetime)
#         department_id = get_user_department(user_id=user_id, db=db)

#         # email_sent_successfully = True | now managed by email_service

#         await sio.emit("new_ride_request", {
#             "ride_id": str(new_ride.id),
#             "user_id": str(user_id),
#             "employee_name": new_ride.username,
#             "status": new_ride.status,
#             "destination": new_ride.stop,
#             "end_datetime": str(new_ride.end_datetime),
#             "date_and_time": str(new_ride.start_datetime),
#             "vehicle_id": str(new_ride.vehicle_id),
#             "requested_vehicle_plate": new_ride.plate_number,
#             "department_id": str(department_id),
#             "distance": new_ride.estimated_distance_km,
#         })

#         supervisor_id = get_supervisor_id(user_id, db)
#         if supervisor_id:
#             employee_name = get_user_name(db, new_ride.user_id)
            
#             # Create and send socket notification to supervisor
#             supervisor_notification = create_system_notification(
#                 user_id=supervisor_id,
#                 title="בקשת נסיעה חדשה",
#                 message=f"שלח בקשה חדשה {employee_name} העובד",
#                 order_id=new_ride.id
#             )
#             # employee_name = get_user_name(db, new_ride.user_id)

#         # if supervisor_id:
#         #     supervisor_notification = create_system_notification(
#         #         user_id=supervisor_id,
#         #         title="בקשת נסיעה חדשה",
#         #         message=f"שלח בקשה חדשה {employee_name} העובד",
#         #         order_id=new_ride.id
#         #     )

#             await sio.emit("new_notification", {
#                 "id": str(supervisor_notification.id),
#                 "user_id": str(supervisor_notification.user_id),
#                 "title": supervisor_notification.title,
#                 "message": supervisor_notification.message,
#                 "notification_type": supervisor_notification.notification_type.value,
#                 "sent_at": supervisor_notification.sent_at.isoformat(),
#                 "order_id": str(supervisor_notification.order_id) if supervisor_notification.order_id else None,
#                 "order_status": new_ride.status
#             })

#             # # שליחת מייל למנהל - כאן הקוראים ל-async_send_email
#             # supervisor_email = get_user_email(supervisor_id, db)
#             # if supervisor_email:
#             #     # Get the city name from the city ID
#             #     destination_city = db.query(City).filter(City.id == new_ride.stop).first()
#             #     destination_name = destination_city.name if destination_city else str(new_ride.stop)

#             #     html_content = load_email_template("new_ride_request.html", {
#             #         "SUPERVISOR_NAME": get_user_name(db, supervisor_id) or "מנהל",
#             #         "EMPLOYEE_NAME": employee_name,
#             #         "DESTINATION": destination_name,  # Now shows the city name
#             #         "DATE_TIME": str(new_ride.start_datetime),
#             #         "PLATE_NUMBER": new_ride.plate_number or "לא נבחר",
#             #         "DISTANCE": str(new_ride.estimated_distance_km),
#             #         "STATUS": new_ride.status,
#             #         # "LINK_TO_ORDER": f"{BOOKIT_URL}/home?order_id={new_ride.id}"
#             #     })
                
#             #     email_sent_successfully = await async_send_email(
#             #         to_email=supervisor_email,
#             #         subject="📄 בקשת נסיעה חדשה מחכה לאישורך",
#             #         html_content=html_content
#             #     )

#             #     # await async_send_email(
#             #     #     to_email=supervisor_email,
#             #     #     subject="📄 בקשת נסיעה חדשה מחכה לאישורך",
#             #     #     html_content=html_content
#             #     # )
#             # else:
#             #     logger.warning(f"No supervisor email found for supervisor ID {supervisor_id} — skipping email.")

#             supervisor_email_address = await email_service._get_user_email(supervisor_id, db) # Use email_service instance
#             if supervisor_email_address:
#                 # Get the city name from the city ID (assuming new_ride.stop is a UUID for City)
#                 destination_city = db.query(City).filter(City.id == new_ride.stop).first()
#                 destination_name = destination_city.name if destination_city else str(new_ride.stop)
#                 ride_details_for_email = {
#                     "username": employee_name, # The rider's name
#                     "ride_id": str(new_ride.id),
#                     "start_location": new_ride.start_location,
#                     "destination": destination_name,
#                     "start_datetime": new_ride.start_datetime,
#                     "end_datetime": new_ride.end_datetime,
#                     "plate_number": new_ride.plate_number,
#                     "ride_type": new_ride.ride_type,
#                     "estimated_distance_km": new_ride.estimated_distance_km,
#                     "status": new_ride.status # Added status for new_ride_request template
#                 }
#                 try:
#                     await email_service.send_ride_creation_email(
#                         ride_id=new_ride.id,
#                         recipient_id=supervisor_id, # Target supervisor
#                         db=db, # Pass db session
#                         ride_details=ride_details_for_email,
#                         email_type="new_ride_request_to_supervisor" # Specific type for supervisor email
#                     )
#                     email_status_output["email_status"] = EmailStatusEnum.SENT # MODIFIED: Set to SENT
#                     email_status_output["email_message"] = "Supervisor email sent successfully." # MODIFIED: Set message
#                     email_status_output["email_timestamp"] = datetime.now().isoformat() # MODIFIED: Set timestamp

#                 except Exception as e:
#                     logger.error(f"Failed to send email to supervisor {supervisor_email_address} for ride {new_ride.id}: {e}", exc_info=True)
#                     email_status_output["email_status"] = EmailStatusEnum.FAILED # MODIFIED: Set to FAILED
#                     email_status_output["email_message"] = f"Failed to send email to supervisor: {e}" # MODIFIED: Set message
#                     email_status_output["email_timestamp"] = datetime.now().isoformat() # MODIFIED: Set timestamp
#                     # --- RETRY LOGIC TRIGGER POINT ---
#                     # This is where you'd queue the email for retry if you had a more advanced system.
#                     # For now, it's logged and the front-end will receive the "FAILED" status.
#                     logger.warning(f"Email to supervisor failed for ride {new_ride.id}. This should be added to a retry queue.")
#             else:
#                 logger.warning(f"No supervisor email found for supervisor ID {supervisor_id} — skipping email.")
#                 email_status_output["email_status"] = EmailStatusEnum.NOT_SENT # MODIFIED: Set to NOT_SENT
#                 email_status_output["email_message"] = f"No email address for supervisor {supervisor_id}." # MODIFIED: Set message
#                 email_status_output["email_timestamp"] = datetime.now().isoformat() # MODIFIED: Set timestamp

#         else:
#             logger.warning(f"No supervisor found for user ID {user_id} — skipping supervisor notification and email.")
#             # ADDED: If no supervisor, explicitly set email status to NOT_SENT for the response
#             email_status_output["email_status"] = EmailStatusEnum.NOT_SENT
#             email_status_output["email_message"] = f"No supervisor found for user {user_id}."
#             email_status_output["email_timestamp"] = datetime.now().isoformat()


#         confirmation = create_system_notification(
#             user_id=new_ride.user_id,
#             title="שליחת בקשה",
#             message="בקשתך נשלחה בהצלחה",
#             order_id=new_ride.id
#         )

#         await sio.emit("new_notification", {
#             "id": str(confirmation.id),
#             "user_id": str(confirmation.user_id),
#             "title": confirmation.title,
#             "message": confirmation.message,
#             "notification_type": confirmation.notification_type.value,
#             "sent_at": confirmation.sent_at.isoformat(),
#             "order_id": str(confirmation.order_id) if confirmation.order_id else None,
#             "order_status": new_ride.status
#         })

#         return {
#             **RideResponse.model_validate(new_ride).dict(),
#             "inspector_warning": warning_flag,
#             # MODIFIED: Use the detailed email_status_output
#             "email_status": email_status_output["email_status"],
#             "email_message": email_status_output["email_message"],
#             "email_timestamp": email_status_output["email_timestamp"]
#         }

#     except Exception as e:
#         logger.error(f"Order creation failed: {str(e)}")
#         raise HTTPException(
#             status_code=fastapi_status.HTTP_400_BAD_REQUEST,
#             detail=f"Failed to create order: {str(e)}"
#         )


@router.get("/api/rides_supposed-to-start")
def check_started_approved_rides(db: Session = Depends(get_db)):
    # Use timezone-aware or naive depending on your DB!
    now = datetime.now(timezone.utc)  # ✅ naive
    # OR
    # now = datetime.now(timezone.utc) # ✅ aware
    
    rides = db.query(Ride).filter(
        Ride.status == RideStatus.approved,
        Ride.start_datetime <= now,
        now <= Ride.start_datetime + text("interval '2 hours'")
    ).all()
    print({"rides_supposed_to_start": [ride.id for ride in rides]})


    return {"rides_supposed_to_start": [ride.id for ride in rides]}

@router.get("/api/departments")
def get_departments_route():
    return get_departments()

@router.get("/api/departments/{department_id}", response_model=DepartmentOut)
def get_department_by_id(department_id: UUID, db: Session = Depends(get_db)):
    department = db.query(Department).filter(Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    return department

@router.patch("/api/orders/{order_id}")
async def patch_order(
    order_id: UUID,
    patch_data: OrderCardItem,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Update the order
    updated_order = patch_order_in_db(order_id, patch_data, db, changed_by=str(current_user.employee_id))
    user = db.query(User).filter(User.employee_id == updated_order.user_id).first()
    vehicle = db.query(Vehicle).filter(Vehicle.id == updated_order.vehicle_id).first()

    # Emit the updated order to the user's room
    order_data = {
    "id": str(updated_order.id),
    "user_id": str(updated_order.user_id),
    "employee_name":f"{user.first_name} {user.last_name}",
    "vehicle_id": str(updated_order.vehicle_id) if updated_order.vehicle_id else None,
    "requested_vehicle_plate":vehicle.plate_number,
    "ride_type": updated_order.ride_type,
    "start_datetime": updated_order.start_datetime,
    "end_datetime": updated_order.end_datetime,
    "start_location": updated_order.start_location,
    "stop": updated_order.stop,
    "destination": updated_order.destination,
    "estimated_distance_km": updated_order.estimated_distance_km,
    "actual_distance_km": updated_order.actual_distance_km,
    "status": updated_order.status.value,
    "license_check_passed": updated_order.license_check_passed,
    "submitted_at": updated_order.submitted_at,
    "emergency_event": updated_order.emergency_event,
}
    if updated_order.extra_stops:
        order_data["extra_stops"] = [str(stop) for stop in updated_order.extra_stops]

    print("Order data to emit:", json.dumps(convert_decimal(order_data), indent=2))
    await sio.emit("order_updated", convert_decimal(order_data))
    return {
        "message": "ההזמנה עודכנה בהצלחה",
        "order": updated_order
    }

@router.post("/api/notification/{user_id}")
async def send_notification_route(
    user_id: UUID,
    notification_data: NotificationOut,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    role_check(["admin", "employee"], token)  # Adjust roles as needed
    identity_check(str(user_id), token)       # Optional

    try:
        notification = await send_notification_async(
            db,
            user_id,
            notification_data.title,
            notification_data.message,
            notification_data.notification_type
        )

        # Emit the notification to the user's Socket.IO room
        await sio.emit("new_notification", {
            "id": str(notification.id),
            "title": notification.title,
            "user_id":str(notification.user_id),
            "message": notification.message,
            "notification_type": notification.notification_type.value,  # if enum
            "sent_at": notification.sent_at.isoformat()
        })

        return {"message": "Notification sent successfully", "notification": notification}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send notification: {str(e)}")


@router.get("/api/notifications/{user_id}", response_model=list[NotificationOut])
def get_notifications_for_user(user_id: UUID, db: Session = Depends(get_db)):
    return get_user_notifications(db, user_id)


@router.delete("/api/all-orders/{order_id}")
async def delete_order(order_id: UUID, db: Session = Depends(get_db),current_user: User = Depends(get_current_user)):
    """
    Delete an order by its ID.
    """
    try:
        db.execute(text('SET session "session.audit.user_id" = :user_id'), {"user_id": str(current_user.employee_id)})
        ride = db.query(Ride).filter(Ride.id == order_id).first()
        if not ride:
            raise HTTPException(status_code=404, detail="Order not found")

        db.delete(ride)
        db.commit()

        # Emit deletion event
        await sio.emit("order_deleted", {"order_id": str(order_id)})
        try:
            scheduler.remove_job(job_id=f"ride-start-{order_id}")
        except JobLookupError:
            pass  # If the job doesn't exist, ignore

        return {"message": "Order deleted successfully"}
    except Exception as e:
        logger.error(f"Failed to delete order {order_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete order")


@router.get("/api/rides/with-locations")
def get_rides_with_locations(db: Session = Depends(get_db)):
    StopCity = aliased(City)

    # Query rides with joined stop city
    rides_with_stop_cities = (
        db.query(Ride, StopCity)
        .join(StopCity, cast(Ride.stop, PG_UUID) == StopCity.id)
        .all()
    )

    # Collect all extra_stop UUIDs from all rides
    all_extra_stop_ids = []
    for ride, _ in rides_with_stop_cities:
        if ride.extra_stops:
            all_extra_stop_ids.extend(ride.extra_stops)
    # Remove duplicates
    all_extra_stop_ids = list(set(all_extra_stop_ids))

    # Query all extra stop cities once
    extra_stop_cities = {}
    if all_extra_stop_ids:
        cities = db.query(City).filter(City.id.in_(all_extra_stop_ids)).all()
        extra_stop_cities = {city.id: city.name for city in cities}

    rides = []
    for ride, stop_city in rides_with_stop_cities:
        extra_stop_names = []
        if ride.extra_stops:
            extra_stop_names = [extra_stop_cities.get(uuid) for uuid in ride.extra_stops if uuid in extra_stop_cities]

        rides.append({
            "id": str(ride.id),
            "start_location_name": FROM_CITY,  # hardcoded
            "destination_name": FROM_CITY_NAME,     # hardcoded
            "stop_name": stop_city.name if stop_city else None,
            "extra_stops_names": extra_stop_names,
        })

    return rides
@router.get("/api/rides/{ride_id}", response_model=RideSchema)
def read_ride(ride_id: UUID, db: Session = Depends(get_db)):

    ride = get_ride_by_id(db, ride_id)
    print('ride to return:',ride)
    return ride


@router.post("/api/complete-ride-form", status_code=fastapi_status.HTTP_200_OK)
async def submit_completion_form(
    form_data: CompletionFormData,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return await process_completion_form(db, user, form_data)


@router.get("/api/archived-orders/{user_id}", response_model=List[RideSchema])
def get_archived_orders_route(
    user_id: UUID,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    role_check(["employee", "admin"], token)
    identity_check(str(user_id), token)

    return get_archived_rides(user_id, db)

@router.get("/api/orders/pending-cars", response_model=List[PendingRideSchema])
def get_pending_car_orders(db: Session = Depends(get_db)):
    pending_rides = (
        db.query(Ride)
        .filter(Ride.status == "pending")
        .all()  
    )

    result = []
    for ride in pending_rides:
        ride_period = "night" if ride.start_datetime.hour >= 18 else "morning"
        result.append({
            "vehicle_id": ride.vehicle_id,
            "ride_period": ride_period,
            "ride_date": ride.start_datetime.date().isoformat(),
            "ride_date_night_end": ride.end_datetime.date().isoformat() if ride_period == "night" else None,
            "start_time": ride.start_datetime.time().strftime("%H:%M"),
            "end_time": ride.end_datetime.time().strftime("%H:%M"),
        })

    return result

@router.get("/api/vehicle-types")
def get_vehicle_types(db: Session = Depends(get_db)):
    types = db.query(Vehicle.type).distinct().all()
    return [t[0] for t in types]




@router.post("/api/forgot-password", status_code=fastapi_status.HTTP_200_OK)
async def forgot_password(
    request: ForgotPasswordRequest,
    response: Response, # Add the Response object to modify the status code on failure
    email_service: EmailService = Depends(get_email_service),
    db: Session = Depends(get_db)
):
    email = request.email
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=fastapi_status.HTTP_404_NOT_FOUND, detail="User not found")

    token = create_reset_token(str(user.employee_id))

    frontend_url = os.getenv("BOOKIT_FRONTEND_URL", "http://localhost:4200")
    reset_link = f"{frontend_url}/reset-password/{token}" # Using the correct path param format

    subject = "🚗 Reset Your Password - Vehicle Desk System"
    context = { "username": user.first_name, "reset_link": reset_link }

    try:
        email_html_content = email_service._render_email_template("password_reset_email.html", context)
    except Exception as e:
        logger.error(f"Failed to render password reset email template: {e}", exc_info=True)
        raise HTTPException(
            status_code=fastapi_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate reset email content."
        )

    # Call the service with use_retries=False for the initial attempt
    email_sent_successfully = await email_service.send_email_direct(
        to_email=user.email,
        subject=subject,
        html_content=email_html_content,
        user_id=user.employee_id,   
        email_type="forgot_password",
        use_retries=False # Correct for an initial, real-time request
    )

    if email_sent_successfully:
        return {"message": "Reset link has been sent"}
    else:
        # --- CHANGE: Return a specific error with the ID needed for retry ---
        logger.error(f"Initial password reset email failed for {user.email}.")
        response.status_code = fastapi_status.HTTP_422_UNPROCESSABLE_ENTITY
        return {
            "detail": "Could not send the password reset email.",
            "retry_info": {
                "identifier_id": str(user.employee_id),
                "email_type": "forgot_password"
            }
        }


@router.post("/api/reset-password")
def reset_password(
    data: ResetPasswordInput,
    db: Session = Depends(get_db)
):
    try:
        user_id: UUID = verify_reset_token(data.token)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user = db.query(User).filter(User.employee_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password = hash_password(data.new_password)
    db.commit()

    return {"message": "Password reset successfully"}

@router.post("/api/orders/{order_id}/cancel")
def cancel_order(order_id: UUID, db: Session = Depends(get_db)):
    return cancel_order_in_db(order_id, db)

@router.get("/api/distance")
def get_distance(
    to_city: str,
    extra_stops: list[str] = Query(default=[]),
    db: Session = Depends(get_db),
):
    try:
        from_city_obj = get_city(FROM_CITY, db)
        if not from_city_obj:
            raise HTTPException(status_code=404, detail="From city not found")

        # Resolve extra stops
        stop_objs = []
        for stop_id in extra_stops:
            stop = db.query(City).filter(City.id == stop_id).first()
            if not stop:
                raise HTTPException(status_code=404, detail=f"Extra stop not found: {stop_id}")
            stop_objs.append(stop)

        # Resolve destination city
        to_city_obj = db.query(City).filter(City.id == to_city).first()
        if not to_city_obj:
            raise HTTPException(status_code=404, detail="Destination city not found")

        # Build full route with city objects
        route = [from_city_obj] + stop_objs + [to_city_obj]

        total_distance = 0
        for i in range(len(route) - 1):
            total_distance += calculate_distance(route[i].id, route[i + 1].id, db)

        return {"distance_km": total_distance}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
        
@router.get("/api/cities")
def get_cities_route(db: Session = Depends(get_db)):
    cities = get_cities(db)
    return [{"id": str(city.id), "name": city.name} for city in cities]

@router.get("/api/city")
def get_city_route(name:str,db: Session = Depends(get_db)):
    city = get_city(name,db)
    return {"id": str(city.id), "name": city.name} 

@router.get("/api/rides/feedback/check/{user_id}")
def check_feedback_needed(
    user_id: UUID,  # Add this parameter to capture the path variable
    db: Session = Depends(get_db)
):
    print(f"Checking feedback for user: {user_id}")
    
    # Get the most recent completed ride for this user that needs feedback
    ride = get_ride_needing_feedback(db, user_id)
    
    print(f"Found ride: {ride}")
    if ride:
        print(f"Ride ID: {ride.id}, Status: {ride.status}, Feedback submitted: {getattr(ride, 'feedback_submitted', 'FIELD_NOT_EXISTS')}")
    
    if not ride:
        return {"showPage": False, "message": "No rides need feedback"}
    
    return {
        "showPage": True,
        "ride_id": str(ride.id),
        "message": "הנסיעה הסתיימה, נא למלא את הטופס"
    }


@router.get("/api/employees/by-department/{user_id}")
def get_employees_by_department(user_id: UUID, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.employee_id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    department_id = user.department_id

    employees = (
        db.query(User)
        .filter(User.department_id == department_id, User.employee_id != user_id)
        .with_entities(User.employee_id, User.first_name, User.last_name)
        .all()
    )

    return [
        {
            "id": str(emp.employee_id),
            "full_name": f"{emp.first_name} {emp.last_name}"
        }
        for emp in employees
    ]

