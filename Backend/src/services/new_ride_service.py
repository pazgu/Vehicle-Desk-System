from sqlalchemy.orm import Session
from uuid import uuid4, UUID
from ..schemas.new_ride_schema import RideCreate
from ..models.ride_model import Ride, RideStatus
from ..models.user_model import User
from ..models.notification_model import Notification, NotificationType
from datetime import datetime

def create_ride(db: Session, user_id: UUID, ride: RideCreate):
    # Get the user info
   
    # Create the new ride
    new_ride = Ride(
        id=uuid4(),
        user_id=user_id,
        vehicle_id='20c28dde-cd3e-498a-9fd0-1a142ddf08b2',
        ride_type=ride.ride_type,
        start_datetime=ride.start_datetime,
        end_datetime=ride.end_datetime,
        start_location=ride.start_location,
        stop=ride.stop,
        destination=ride.destination,
        estimated_distance_km=ride.estimated_distance_km,
        status=RideStatus.pending,
        license_check_passed=False,
        submitted_at=datetime.utcnow(),
    )
    db.add(new_ride)
    db.commit()
    db.refresh(new_ride)

    # Notify supervisors in the same department
    supervisors = db.query(User).filter(
        User.department_id == user.department_id,
        User.is_supervisor == True
    ).all()

    for supervisor in supervisors:
        notification = Notification(
            id=uuid4(),
            user_id=supervisor.id,
            notification_type=NotificationType.system,
            title="נסיעה חדשה נוצרה",
            message=f"המשתמש {user.full_name} יצר נסיעה חדשה במחלקה שלך.",
            sent_at=datetime.utcnow()
        )
        db.add(notification)

    db.commit()
    return new_ride
