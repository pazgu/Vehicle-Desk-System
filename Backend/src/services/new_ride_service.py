from sqlalchemy.orm import Session
from sqlalchemy import text
from uuid import uuid4, UUID

from ..schemas.new_ride_schema import RideCreate, RideResponse
from ..models.ride_model import Ride, RideStatus
from ..models.user_model import User
from ..utils.email_utils import send_email
from datetime import datetime, timedelta, timezone
from ..utils.audit_utils import log_action
from ..models.vehicle_model import Vehicle
from ..utils.socket_manager import sio
from src.constants import OFFROAD_TYPES
from fastapi import HTTPException
from ..services.user_notification import create_system_notification, send_admin_odometer_notification

def is_offroad_vehicle(vehicle_type: str) -> bool:
    return any(keyword.lower() in vehicle_type.lower() for keyword in OFFROAD_TYPES)

async def create_ride(db: Session, user_id: UUID, ride: RideCreate):
    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user_id)})

    vehicle = db.query(Vehicle).filter(Vehicle.id == ride.vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    if vehicle.lease_expiry <= datetime.utcnow():
        raise HTTPException(status_code=404, detail="Vehicle is expired")



    user = db.query(User).filter(User.employee_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role == "employee" and not user.has_government_license:
        raise HTTPException(
            status_code=403,
            detail="You must have a government license to request a ride."
        )
    now = datetime.now(timezone.utc)
    if user.is_blocked and user.block_expires_at and now < user.block_expires_at:
        raise HTTPException(
            status_code=403,
            detail=f"You are currently blocked from booking until {user.block_expires_at.strftime('%Y-%m-%d %H:%M:%S')}."
        )

    if is_offroad_vehicle(vehicle.type) and not ride.four_by_four_reason:
        raise HTTPException(
            status_code=400,
            detail="A reason must be provided when requesting an off-road vehicle."
        )

    # Determine who is the rider
    rider_id = ride.user_id

    new_ride = Ride(
        id=uuid4(),
        user_id=rider_id,
        override_user_id=ride.override_user_id if ride.override_user_id else user_id,
        vehicle_id=ride.vehicle_id,
        ride_type=ride.ride_type,
        start_datetime=ride.start_datetime,
        end_datetime=ride.end_datetime,
        start_location=ride.start_location,
        stop=ride.stop,
        destination=ride.destination,
        estimated_distance_km=ride.estimated_distance_km,
        actual_distance_km=ride.actual_distance_km,
        four_by_four_reason=ride.four_by_four_reason,
        status=RideStatus.pending,
        license_check_passed=False,
        submitted_at=datetime.now(timezone.utc),
        extra_stops = ride.extra_stops or None
    )

    vehicle.mileage += ride.estimated_distance_km

    db.add(new_ride)
    db.commit()
    db.refresh(new_ride)
    db.refresh(vehicle)

    await sio.emit("ride_status_updated", {
        "ride_id": str(new_ride.id),
        "new_status": new_ride.status.value
    })
    await send_admin_odometer_notification(vehicle.id, vehicle.mileage)


    # Notification for delegated ride
    if ride.target_type == "other" and ride.user_id:
        delegated_notification = create_system_notification(
            user_id=ride.user_id,
            title="בקשת נסיעה חדשה עבורך",
            message="משתמש אחר הגיש עבורך בקשה לנסיעה",
            order_id=new_ride.id
        )
        await sio.emit("new_notification", {
            "id": str(delegated_notification.id),
            "user_id": str(delegated_notification.user_id),
            "title": delegated_notification.title,
            "message": delegated_notification.message,
            "notification_type": delegated_notification.notification_type.value,
            "sent_at": delegated_notification.sent_at.isoformat(),
            "order_id": str(delegated_notification.order_id) if delegated_notification.order_id else None,
            "order_status": new_ride.status,


        })


    db.execute(text("SET session.audit.user_id = DEFAULT"))

    ride_response = RideResponse(
        **new_ride.__dict__,
        plate_number=vehicle.plate_number,
        username=f"{user.first_name} {user.last_name}",
    )
    ride_response_dict = ride_response.dict()
    ride_response_dict.pop('_sa_instance_state', None)

    return ride_response



async def create_supervisor_ride(db: Session, user_id: UUID, ride: RideCreate):
    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user_id)})

    vehicle = db.query(Vehicle).filter(Vehicle.id == ride.vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    if vehicle.lease_expiry <= datetime.utcnow():
        raise HTTPException(status_code=404, detail="Vehicle is expired")



    user = db.query(User).filter(User.employee_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role == "supervisor" and not user.has_government_license:
        raise HTTPException(
            status_code=403,
            detail="You must have a government license to request a ride."
        )
    now = datetime.now(timezone.utc)
    if user.is_blocked and user.block_expires_at and now < user.block_expires_at:
        raise HTTPException(
            status_code=403,
            detail=f"You are currently blocked from booking until {user.block_expires_at.strftime('%Y-%m-%d %H:%M:%S')}."
        )

    if is_offroad_vehicle(vehicle.type) and not ride.four_by_four_reason:
        raise HTTPException(
            status_code=400,
            detail="A reason must be provided when requesting an off-road vehicle."
        )

    # Determine who is the rider
    rider_id = ride.user_id

    new_ride = Ride(
        id=uuid4(),
        user_id=rider_id,
        override_user_id=ride.override_user_id if ride.override_user_id else user_id,
        vehicle_id=ride.vehicle_id,
        ride_type=ride.ride_type,
        start_datetime=ride.start_datetime,
        end_datetime=ride.end_datetime,
        start_location=ride.start_location,
        stop=ride.stop,
        destination=ride.destination,
        estimated_distance_km=ride.estimated_distance_km,
        actual_distance_km=ride.actual_distance_km,
        four_by_four_reason=ride.four_by_four_reason,
        status=RideStatus.approved,
        license_check_passed=False,
        submitted_at=datetime.now(timezone.utc),
        extra_stops = ride.extra_stops or None
    )

    vehicle.mileage += ride.estimated_distance_km

    db.add(new_ride)
    db.commit()
    db.refresh(new_ride)
    db.refresh(vehicle)

    await sio.emit("ride_status_updated", {
        "ride_id": str(new_ride.id),
        "new_status": new_ride.status.value
    })
    await send_admin_odometer_notification(vehicle.id, vehicle.mileage)


    # # Notification for delegated ride
    # if ride.target_type == "other" and ride.user_id:
    #     delegated_notification = create_system_notification(
    #         user_id=ride.user_id,
    #         title="בקשת נסיעה חדשה עבורך",
    #         message="משתמש אחר הגיש עבורך בקשה לנסיעה",
    #         order_id=new_ride.id
    #     )
    #     await sio.emit("new_notification", {
    #         "id": str(delegated_notification.id),
    #         "user_id": str(delegated_notification.user_id),
    #         "title": delegated_notification.title,
    #         "message": delegated_notification.message,
    #         "notification_type": delegated_notification.notification_type.value,
    #         "sent_at": delegated_notification.sent_at.isoformat(),
    #         "order_id": str(delegated_notification.order_id) if delegated_notification.order_id else None,
    #         "order_status": new_ride.status,


    #     })

    db.execute(text("SET session.audit.user_id = DEFAULT"))

    ride_response = RideResponse(
        **new_ride.__dict__,
        plate_number=vehicle.plate_number,
        username=f"{user.first_name} {user.last_name}",
    )
    ride_response_dict = ride_response.dict()
    ride_response_dict.pop('_sa_instance_state', None)

    return ride_response
