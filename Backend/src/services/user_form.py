from fastapi import HTTPException, status
from datetime import datetime, timezone
import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import Optional

from ..helpers.user_helpers import cancel_future_rides_for_vehicle

from ..models.user_model import User,UserRole
from ..models.ride_model import Ride,RideStatus
from ..models.notification_model import Notification,NotificationType
from ..models.vehicle_model import Vehicle, VehicleStatus,FreezeReason

from ..schemas.form_schema import CompletionFormData

from ..utils.socket_manager import sio
from .user_notification import create_system_notification_with_db, get_user_name

from ..services.admin_rides_service import update_monthly_usage_stats
from ..services.user_notification import emit_new_notification

load_dotenv() 
BOOKIT_URL = os.getenv("BOOKIT_FRONTEND_URL", "http://localhost:4200")

def get_ride_needing_feedback(db: Session, user_id: int) -> Optional[Ride]:

    ride = db.query(Ride).filter(
        Ride.user_id == user_id,
        Ride.end_datetime <= datetime.now(timezone.utc),
        Ride.feedback_submitted == False,
        Ride.status == RideStatus.in_progress 
    ).order_by(
        Ride.end_datetime.desc()
    ).first()
    
    return ride

def mark_feedback_submitted(db: Session, ride_id: str):
    """
    Mark a ride as having feedback submitted.
    """
    ride = db.query(Ride).filter_by(id=ride_id).first()
    if ride:
        ride.feedback_submitted = True

        db.commit()
    return ride

# async def process_completion_form(db: Session, user: User, form_data: CompletionFormData):
#     ride = db.query(Ride).filter_by(id=form_data.ride_id, user_id=user.employee_id).first()
#     if not ride:
#         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ride not found")

#     db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user.employee_id)})

#     supervisors = db.query(User).filter_by(
#         department_id=user.department_id,
#         role=UserRole.supervisor
#     ).all()

#     # עדכון שדות בסיסיים של הנסיעה
#     if form_data.emergency_event:
#         ride.emergency_event = form_data.emergency_event

#     # תמיד נסמן נסיעה כהושלמה
#     try:
#         ride.status = RideStatus.completed
#         ride.completion_date = datetime.now(timezone.utc)
#         update_monthly_usage_stats(db=db, ride=ride)
#         increment_completed_trip_stat(db, ride.user_id, ride.start_datetime)
#     except Exception as e:
#         print("Exception after ride.status update:", repr(e))

#     # עדכון מצב הרכב
#     vehicle = db.query(Vehicle).filter_by(id=ride.vehicle_id).first()
#     if not vehicle:
#         raise HTTPException(status_code=404, detail="Vehicle not found")

#     vehicle.last_used_at = ride.end_datetime
#     vehicle.last_user_id = ride.user_id

#     is_emergency = form_data.emergency_event == 'true'

#     if is_emergency:
#         vehicle.status = VehicleStatus.frozen
#         vehicle.freeze_reason = FreezeReason.accident
#         vehicle.freeze_details = form_data.freeze_details

#         for supervisor in supervisors:
#             notification = create_system_notification_with_db(
#                 db=db,
#                 user_id=supervisor.employee_id,
#                 title="חריגה בסיום הנסיעה",
#                 message=f"{vehicle.plate_number} עבר חריגה בסיום הנסיעה {user.last_name} {user.first_name} המשתמש ",
#                 order_id=ride.id
#             )
#             loop = asyncio.get_running_loop()
#             loop.call_soon_threadsafe(asyncio.create_task, emit_new_notification(notification, ride.status))

#             supervisor_email = get_user_email(supervisor.employee_id, db)
#             if supervisor_email:
#                 employee_name = get_user_name(db, user.employee_id)
#                 supervisor_name = get_user_name(db, supervisor.employee_id) or "מנהל"
#                 html_content = load_email_template("emergency_alert.html", {
#                     "SUPERVISOR_NAME": supervisor_name,
#                     "EMPLOYEE_NAME": employee_name,
#                     "PLATE_NUMBER": vehicle.plate_number,
#                     "RIDE_ID": str(ride.id),
#                     "FREEZE_REASON": vehicle.freeze_reason.value,
#                     "FREEZE_DETAILS": vehicle.freeze_details,
#                     "LINK_TO_RIDE": f"{BOOKIT_URL}/ride/details/{ride.id}"
#                 })
#                 try:
#                     await async_send_email(
#                         to_email=supervisor_email,
#                         subject=f"🚨 התרעה: חריגה בסיום הנסיעה {vehicle.plate_number}",
#                         html_content=html_content
#                     )
#                 except Exception as email_e:
#                     print(f"Failed to send emergency email: {repr(email_e)}")
#     else:
#         vehicle.status = VehicleStatus.available

#     # אם הרכב לא מוכן לנסיעה הבאה
#     if form_data.is_vehicle_ready_for_next_ride is False:
#         for supervisor in supervisors:
#             notification = create_system_notification_with_db(
#                 db=db,
#                 user_id=supervisor.employee_id,
#                 title="רכב לא מוכן לנסיעה הבאה",
#                 message=f"לא מוכן לנסיעה הבאה {vehicle.plate_number} רכב ",
#                 vehicle_id=vehicle.id
#             )
#             loop = asyncio.get_running_loop()
#             loop.call_soon_threadsafe(asyncio.create_task, emit_new_notification(notification=notification, vehicle_id=vehicle.id))

#             supervisor_email = get_user_email(supervisor.employee_id, db)
#             if supervisor_email:
#                 employee_name = get_user_name(db, user.employee_id)
#                 supervisor_name = get_user_name(db, supervisor.employee_id) or "מנהל"
#                 html_content = load_email_template("vehicle_not_ready.html", {
#                     "SUPERVISOR_NAME": supervisor_name,
#                     "EMPLOYEE_NAME": employee_name,
#                     "PLATE_NUMBER": vehicle.plate_number,
#                     "VEHICLE_ID": str(vehicle.id),
#                     "LINK_TO_VEHICLE": f"{BOOKIT_URL}/vehicle-details/{vehicle.id}"
#                 })
#                 try:
#                     await async_send_email(
#                         to_email=supervisor_email,
#                         subject=f"⚠️ התרעה: רכב {vehicle.plate_number} לא מוכן לנסיעה הבאה",
#                         html_content=html_content
#                     )
#                 except Exception as email_e:
#                     print(f"Failed to send 'not ready' email: {repr(email_e)}")

#     # אם לא תודלק
#     if not form_data.fueled:
#         for supervisor in supervisors:
#             notification = create_system_notification_with_db(
#                 db=db,
#                 user_id=supervisor.employee_id,
#                 title="רכב לא תודלק",
#                 message=f"בלי תדלוק {vehicle.plate_number} החזיר הרכב {user.last_name} {user.first_name} המשתמש ",
#                 order_id=ride.id
#             )
#             asyncio.create_task(emit_new_notification(notification, ride.status))

#     await sio.emit('ride_status_updated', {
#         "ride_id": str(ride.id),
#         "new_status": ride.status,
#     })

#     await sio.emit('vehicle_status_updated', {
#         "vehicle_id": str(vehicle.id),
#         "status": vehicle.status,
#     })

#     mark_feedback_submitted(db, ride.id)
#     db.commit()

#     return {"message": "Completion form processed successfully."}


async def process_completion_form(db: Session, user: User, form_data: CompletionFormData):
    try:
        ride = db.query(Ride).filter_by(
            id=form_data.ride_id,
            user_id=user.employee_id
        ).first()

        if not ride:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Ride not found"
            )

        db.execute(
            text("SET session.audit.user_id = :user_id"),
            {"user_id": str(user.employee_id)}
        )

        supervisors = db.query(User).filter_by(
            department_id=user.department_id,
            role=UserRole.supervisor
        ).all()

        if form_data.emergency_event:
            ride.emergency_event = form_data.emergency_event

        ride.status = RideStatus.completed
        ride.completion_date = datetime.now(timezone.utc)
        update_monthly_usage_stats(db=db, ride=ride)

        vehicle = db.query(Vehicle).filter_by(id=ride.vehicle_id).first()
        if not vehicle:
            raise HTTPException(404, "Vehicle not found")

        vehicle.last_used_at = ride.end_datetime
        vehicle.last_user_id = ride.user_id

        is_emergency = form_data.emergency_event == 'true'
        vehicle_becomes_frozen = False

        if is_emergency:
            vehicle.status = VehicleStatus.frozen
            vehicle.freeze_reason = FreezeReason.accident
            vehicle.freeze_details = form_data.freeze_details
            vehicle_becomes_frozen = True

            # your email + notif logic here...
            pass

        else:
            vehicle.status = VehicleStatus.available


        if form_data.is_vehicle_ready_for_next_ride is False:
            # your logic...
            pass

        if not form_data.fueled:
            # your logic...
            pass

        ride.feedback_submitted = True

        db.commit()
        cancelled_result = None

        if vehicle_becomes_frozen:
            cancelled_result =  cancel_future_rides_for_vehicle(vehicle.id, db,user.employee_id)
        if cancelled_result is None:
            cancelled_result = {"cancelled": [], "users": []}

            await sio.emit('reservationCanceledDueToVehicleFreeze', {
                "vehicle_id": str(vehicle.id),
                "cancelled_rides": cancelled_result["cancelled"],
                "affected_users": [str(u) for u in cancelled_result["users"]],
                "status": vehicle.status,
                "freeze_reason": vehicle.freeze_reason or ""
            })

        await sio.emit('ride_status_updated', {
            "ride_id": str(ride.id),
            "new_status": ride.status.value,
        })

        await sio.emit('vehicle_status_updated', {
            "vehicle_id": str(vehicle.id),
            "status": vehicle.status.value,
        })

        response = {
            "message": "Completion form processed successfully."
        }

        if cancelled_result:
            response["cancelled_rides"] = cancelled_result["cancelled"]
            response["affected_users"] = cancelled_result["users"]

        return response

    except Exception as e:
        db.rollback()
        print(f"Failed to process completion form, rolling back: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal server error occurred while processing the form."
        )
