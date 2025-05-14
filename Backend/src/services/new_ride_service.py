from sqlalchemy.orm import Session
from uuid import uuid4, UUID
from ..schemas.new_ride_schema import RideCreate
from ..models.ride_model import Ride, RideStatus
from ..models.user_model import User  
from ..utils.email_utils import send_email  
from datetime import datetime

def create_ride(db: Session, user_id: UUID, ride: RideCreate):
    new_ride = Ride(
        id=uuid4(),
        user_id=user_id,
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

    # Fetch the user who submitted the ride
    user = db.query(User).filter(User.employee_id == user_id).first()

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
