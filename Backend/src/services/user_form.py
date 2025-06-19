import asyncio
from sqlalchemy.orm import Session
from ..models.user_model import User,UserRole
from ..models.ride_model import Ride,RideStatus
from ..models.notification_model import Notification,NotificationType
from ..models.vehicle_model import Vehicle, VehicleStatus,FreezeReason
from ..schemas.form_schema import CompletionFormData
from fastapi import HTTPException, status
from datetime import datetime, timezone
from .user_notification import create_system_notification_with_db
from .monthly_trip_counts import increment_completed_trip_stat
from ..services.user_notification import emit_new_notification
from ..utils.socket_manager import sio
from typing import Optional
from ..services.admin_rides_service import update_monthly_usage_stats

def get_ride_needing_feedback(db: Session, user_id: int) -> Optional[Ride]:
    return db.query(Ride).filter(
        Ride.user_id == user_id,
        Ride.end_datetime <= datetime.now(timezone.utc),
        Ride.status == RideStatus.completed,
        Ride.feedback_submitted == False  
    ).order_by(
        Ride.end_datetime.desc()
    ).first()

def mark_feedback_submitted(db: Session, ride_id: str):
    """
    Mark a ride as having feedback submitted.
    """
    ride = db.query(Ride).filter_by(id=ride_id).first()
    if ride:
        ride.feedback_submitted = True
        db.commit()
    return ride
async def process_completion_form(db: Session, user: User, form_data: CompletionFormData):
    print("this is the current user:",user.username)
    print("dep id:",user.department_id)
    print("user id:",user.employee_id)
 
    # 1. Get the ride for this user
    ride = db.query(Ride).filter_by(id=form_data.ride_id, user_id=user.employee_id).first()
    if not ride:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ride not found")

    print ("ride id",ride.id)
    # 2. Set emergency event if provided
    if form_data.emergency_event:
        ride.emergency_event = form_data.emergency_event

    # 3. If ride is completed, update ride status and vehicle status
    print("completed?",form_data.completed)
    if form_data.completed:
        ride.status = RideStatus.completed

        # הוספת עדכון סטטיסטיקות שימוש ברכב:
        update_monthly_usage_stats(db=db, ride=ride)

        # Increment completed trips count for the employee immediately.
        increment_completed_trip_stat(db, ride.user_id, ride.start_datetime)

        # 4. Update vehicle status
        vehicle = db.query(Vehicle).filter_by(id=ride.vehicle_id).first()
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found")

        if form_data.emergency_event:
            vehicle.status = VehicleStatus.frozen  # Freeze vehicle due to emergency
            vehicle.freeze_reason = FreezeReason.accident
            vehicle.freeze_details = form_data.freeze_details
            supervisors = db.query(User).filter_by(
                department_id=user.department_id,
                role=UserRole.supervisor
            ).all()

            for supervisor in supervisors:
                notification=create_system_notification_with_db(
                    db=db,
                    user_id=supervisor.employee_id,
                    title="רכב עבר תאונה",
                    message=f"{vehicle.plate_number} עבר תאונה ברכב {user.last_name} {user.first_name} המשתמש ",
                    order_id=ride.id
                )
                asyncio.create_task(emit_new_notification(notification, ride.status))

        else:
            vehicle.status = VehicleStatus.available  # Set available if no emergency

        # 5. If vehicle not fueled, notify supervisor(s)
        if not form_data.fueled:
            supervisors = db.query(User).filter_by(
                department_id=user.department_id,
                role=UserRole.supervisor
            ).all()

            for supervisor in supervisors:
                notification=create_system_notification_with_db(
                    db=db,
                    user_id=supervisor.employee_id,
                    title="רכב לא תודלק",
                    message=f"בלי תדלוק {vehicle.plate_number} החזיר הרכב {user.last_name} {user.first_name} המשתמש ",
                    order_id=ride.id
                )
                asyncio.create_task(emit_new_notification(notification, ride.status))

             # Emit ride status updated event
        sio.emit('ride_status_updated', {
            "ride_id": str(ride.id),
            "status": ride.status,
        })

        # Emit vehicle status updated event
        sio.emit('vehicle_status_updated', {
            "vehicle_id": str(vehicle.id),
            "status": vehicle.status,
        })

    db.commit()
    return {"message": "Completion form processed successfully."}
