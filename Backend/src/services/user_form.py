from sqlalchemy.orm import Session
from ..models.user_model import User,UserRole
from ..models.ride_model import Ride,RideStatus
from ..models.notification_model import Notification,NotificationType
from ..models.vehicle_model import Vehicle, VehicleStatus,FreezeReason
from ..schemas.form_schema import CompletionFormData
from fastapi import HTTPException, status
from datetime import datetime, timezone
from .user_notification import create_system_notification_with_db

def process_completion_form(db: Session, user: User, form_data: CompletionFormData):
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
                create_system_notification_with_db(
                    db=db,
                    user_id=supervisor.employee_id,
                    title="רכב עבר תאונה",
                    message=f"{vehicle.plate_number} עבר תאונה ברכב {user.last_name} {user.first_name} המשתמש ",
                    order_id=ride.id
                )
        else:
            vehicle.status = VehicleStatus.available  # Set available if no emergency

        # 5. If vehicle not fueled, notify supervisor(s)
        if not form_data.fueled:
            supervisors = db.query(User).filter_by(
                department_id=user.department_id,
                role=UserRole.supervisor
            ).all()

            for supervisor in supervisors:
                create_system_notification_with_db(
                    db=db,
                    user_id=supervisor.employee_id,
                    title="רכב לא תודלק",
                    message=f"בלי תדלוק {vehicle.plate_number} החזיר הרכב {user.last_name} {user.first_name} המשתמש ",
                    order_id=ride.id
                )


    db.commit()
    return {"message": "Completion form processed successfully."}
