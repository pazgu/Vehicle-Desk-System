from sqlalchemy.orm import Session
from uuid import uuid4, UUID
from ..schemas.new_ride_schema import RideCreate
from ..models.ride_model import Ride, RideStatus
from ..models.user_model import User  
from ..utils.email_utils import send_email  
from datetime import datetime
from ..utils.audit_utils import log_action

def create_ride(db: Session, user_id: UUID, ride: RideCreate):
    # Get the user info
   
    # Create the new ride
    new_ride = Ride(
        id=uuid4(),
        user_id=user_id,
        vehicle_id=ride.vehicle_id,
        ride_type=ride.ride_type,
        start_datetime=ride.start_datetime,
        end_datetime=ride.end_datetime,
        start_location=ride.start_location,
        stop=ride.stop,
        destination=ride.destination,
        estimated_distance_km=ride.estimated_distance_km,
        actual_distance_km=ride.actual_distance_km,  # ✅ ADD THIS LINE
        status=RideStatus.pending,
        license_check_passed=False,
        submitted_at=datetime.utcnow(),
        override_user_id=user_id
    )

    print("🚗 New ride object:", new_ride)
    print(new_ride)
    db.add(new_ride)
    db.commit()
    db.refresh(new_ride)

    # Fetch the user who submitted the ride
    user = db.query(User).filter(User.employee_id == user_id).first()

    log_action(
        db=db,
        action="create_ride",
        entity_type="Ride",
        entity_id=str(new_ride.id),
        change_data={
            "start_location": new_ride.start_location,
            "destination": new_ride.destination,
            "start_datetime": new_ride.start_datetime.isoformat(),
            "end_datetime": new_ride.end_datetime.isoformat(),
            "submitted_by": str(user_id)
        },
        changed_by=user_id
    )

    # Fetch all admin users
    admins = db.query(User).filter(User.role == "admin").all()
    admin_emails = [admin.email for admin in admins]

    # Email content
    subject = "New Ride Request Submitted"
    body = f"""Hello,

A new ride has been submitted by {user.first_name} {user.last_name} ({user.email}).

Ride Details:
- From: {ride.start_location}
- To: {ride.destination}
- Start: {ride.start_datetime}
- End: {ride.end_datetime}
- Status: Pending

Thank you,
Ride Management System
"""

    # Send the email to both the user and all admins
    recipients = [user.email] + admin_emails
    send_email(subject, body, recipients)

    return new_ride
