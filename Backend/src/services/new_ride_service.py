from sqlalchemy.orm import Session
from sqlalchemy import text
from uuid import uuid4, UUID
from ..schemas.new_ride_schema import RideCreate,RideResponse
from ..models.ride_model import Ride, RideStatus
from ..models.user_model import User  
from ..utils.email_utils import send_email  
from datetime import datetime, timezone
from ..utils.audit_utils import log_action
from ..models.vehicle_model import Vehicle
from ..models.monthly_vehicle_usage_model import MonthlyVehicleUsage

from ..utils.socket_manager import sio
from src.constants import OFFROAD_TYPES 
from fastapi import HTTPException

# Helper function to check if vehicle type matches any off-road keywords
def is_offroad_vehicle(vehicle_type: str) -> bool:
    return any(keyword.lower() in vehicle_type.lower() for keyword in OFFROAD_TYPES)

async def create_ride(db: Session, user_id: UUID, ride: RideCreate):
    # Get the user info
    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user_id)})

    vehicle = db.query(Vehicle).filter(Vehicle.id == ride.vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    if is_offroad_vehicle(vehicle.type) and not ride.four_by_four_reason:
        raise HTTPException(
            status_code=400,
            detail="A reason must be provided when requesting an off-road vehicle."
        )
   
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
        four_by_four_reason=ride.four_by_four_reason,
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

    await sio.emit("ride_status_updated", {
    "ride_id": str(new_ride.id),
    "new_status": new_ride.status.value
})

    # Fetch the user who submitted the ride
    user = db.query(User).filter(User.employee_id == user_id).first()

    print("user id:", user_id)

    # log_action(
    #     db=db,
    #     action="create_ride",
    #     entity_type="Ride",
    #     entity_id=str(new_ride.id),
    #     change_data={
    #         "start_location": new_ride.start_location,
    #         "destination": new_ride.destination,
    #         "start_datetime": new_ride.start_datetime.isoformat(),
    #         "end_datetime": new_ride.end_datetime.isoformat(),
    #         "submitted_by": str(user_id)
    #     },
    #     changed_by=user_id
    # )


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
    db.execute(text("SET session.audit.user_id = DEFAULT"))
    ride_response = RideResponse(
        **new_ride.__dict__,
        plate_number=vehicle.plate_number,
        username=f"{user.first_name} {user.last_name}",
    )
    ride_response_dict = ride_response.dict()
    ride_response_dict.pop('_sa_instance_state', None)

    from sqlalchemy.orm import Session
from sqlalchemy import text
from uuid import uuid4, UUID
from ..schemas.new_ride_schema import RideCreate,RideResponse
from ..models.ride_model import Ride, RideStatus
from ..models.user_model import User  
from ..utils.email_utils import send_email  
from datetime import datetime
from ..utils.audit_utils import log_action
from ..models.vehicle_model import Vehicle
from ..utils.socket_manager import sio

async def create_ride(db: Session, user_id: UUID, ride: RideCreate):
    # Get the user info
    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user_id)})

   
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
        submitted_at=datetime.now(timezone.utc),
        override_user_id=user_id
    )
    vehicle = db.query(Vehicle).filter(Vehicle.id == ride.vehicle_id).first()

    print("🚗 New ride object:", new_ride)
    print(new_ride)
    db.add(new_ride)
    db.commit()
    db.refresh(new_ride)

    await sio.emit("ride_status_updated", {
    "ride_id": str(new_ride.id),
    "new_status": new_ride.status.value
})

    # Fetch the user who submitted the ride
    user = db.query(User).filter(User.employee_id == user_id).first()

    print("user iddddddddddddddddddddddddddddddddddddd:", user_id)

    # log_action(
    #     db=db,
    #     action="create_ride",
    #     entity_type="Ride",
    #     entity_id=str(new_ride.id),
    #     change_data={
    #         "start_location": new_ride.start_location,
    #         "destination": new_ride.destination,
    #         "start_datetime": new_ride.start_datetime.isoformat(),
    #         "end_datetime": new_ride.end_datetime.isoformat(),
    #         "submitted_by": str(user_id)
    #     },
    #     changed_by=user_id
    # )


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
    db.execute(text("SET session.audit.user_id = DEFAULT"))
    ride_response = RideResponse(
        **new_ride.__dict__,
        plate_number=vehicle.plate_number,
        username=f"{user.first_name} {user.last_name}",
    )
    ride_response_dict = ride_response.dict()
    ride_response_dict.pop('_sa_instance_state', None)

    return ride_response
