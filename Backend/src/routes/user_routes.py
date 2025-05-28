import traceback
from fastapi import APIRouter, HTTPException, Depends , Query
from sqlalchemy.orm import Session
from ..schemas.register_schema import UserCreate
from ..schemas.login_schema import UserLogin
from ..schemas.new_ride_schema import RideCreate
from ..services import register_service
from ..services.auth_service import create_access_token
from ..services import login_service
from uuid import UUID
from ..services.new_ride_service import create_ride 
from fastapi.responses import JSONResponse
from typing import List, Optional, Union
from datetime import datetime
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
from ..utils.auth import role_check,identity_check,get_current_user
from src.schemas.ride_status_enum import UpdateRideStatusRequest
from ..schemas.order_card_item import OrderCardItem
from ..models.ride_model import Ride
from ..services.user_edit_ride import patch_order_in_db
from ..services.user_rides_service import get_ride_by_id , get_archived_rides
from ..services.user_notification import create_system_notification,get_supervisor_id,get_user_name
import traceback
from ..models.user_model import User
from ..services.user_form import process_completion_form
from ..schemas.form_schema import CompletionFormData
from ..utils.socket_manager import sio  # ✅ import this
from ..utils.socket_utils import convert_decimal
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
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

@router.post("/api/orders/{user_id}", response_model=RideCreate, status_code=fastapi_status.HTTP_201_CREATED)
async def create_order(user_id: UUID, ride_request: RideCreate, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    role_check(allowed_roles=["employee", "admin"], token=token)
    identity_check(user_id=str(user_id), token=token)

    print("📥 Received RideCreate object:", ride_request.dict())

    try:
        new_ride = create_ride(db, user_id, ride_request)

        # ✅ Emit real-time event
        await sio.emit("ride_created", {
            "ride_id": str(new_ride.id),
            "user_id": str(user_id),
            "status": new_ride.status,
            "destination": new_ride.destination
        })

        supervisor_id = get_supervisor_id(user_id, db)
        employee_name = get_user_name(db, new_ride.user_id)

        if supervisor_id:
            create_system_notification(
                user_id=supervisor_id,
                title="בקשת נסיעה חדשה",
                message=f"שלח בקשה חדשה {employee_name} העובד",
                order_id=new_ride.id
            )
        else:
            logger.warning("No supervisor found — skipping supervisor notification.")

        create_system_notification(
            user_id=new_ride.user_id,
            title="שליחת בקשה",
            message="בקשתך נשלחה בהצלחה",
            order_id=new_ride.id
        )

        return new_ride

    except Exception as e:
        logger.error(f"Order creation failed: {str(e)}")
        raise HTTPException(
            status_code=fastapi_status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create order: {str(e)}"
        )

@router.get("/api/departments")
def get_departments_route():
    return get_departments()

@router.patch("/api/orders/{order_id}")
async def patch_order(order_id: UUID, patch_data: OrderCardItem, db: Session = Depends(get_db)):
    # Update the order
    updated_order = patch_order_in_db(order_id, patch_data, db)
    
    # Emit the updated order to the user's room
    order_data = {
    "id": str(updated_order.id),
    "user_id": str(updated_order.user_id),
    "vehicle_id": str(updated_order.vehicle_id) if updated_order.vehicle_id else None,
    "ride_type": updated_order.ride_type,
    "start_datetime": updated_order.start_datetime.isoformat(),
    "end_datetime": updated_order.end_datetime.isoformat(),
    "start_location": updated_order.start_location,
    "stop": updated_order.stop,
    "destination": updated_order.destination,
    "estimated_distance_km": updated_order.estimated_distance_km,
    "actual_distance_km": updated_order.actual_distance_km,
    "status": updated_order.status.value,
    "license_check_passed": updated_order.license_check_passed,
    "submitted_at": updated_order.submitted_at.isoformat(),
    "emergency_event": updated_order.emergency_event,
}

    await sio.emit("order_updated", convert_decimal(order_data), room=str(updated_order.user_id))
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
        await sio.emit("notification", {
            "id": str(notification.id),
            "title": notification.title,
            "message": notification.message,
            "notification_type": notification.notification_type.value,  # if enum
            "sent_at": notification.sent_at.isoformat()
        }, room=str(user_id))

        return {"message": "Notification sent successfully", "notification": notification}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send notification: {str(e)}")


@router.get("/api/notifications/{user_id}", response_model=list[NotificationOut])
def get_notifications_for_user(user_id: UUID, db: Session = Depends(get_db)):
    return get_user_notifications(db, user_id)


@router.delete("/api/orders/{user_id}")
def delete_order():
    # Implementation pending
    return {"message": "Not implemented yet"}

@router.get("/api/rides/{ride_id}", response_model=RideSchema)
def read_ride(ride_id: UUID, db: Session = Depends(get_db)):
    ride = get_ride_by_id(db, ride_id)
    return ride

@router.post("/api/complete-ride-form", status_code=fastapi_status.HTTP_200_OK)
def submit_completion_form(
    form_data: CompletionFormData,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return process_completion_form(db, user, form_data)


@router.get("/api/archived-orders/{user_id}", response_model=List[RideSchema])
def get_archived_orders_route(
    user_id: UUID,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    role_check(["employee", "admin"], token)
    identity_check(str(user_id), token)

    return get_archived_rides(user_id, db)

