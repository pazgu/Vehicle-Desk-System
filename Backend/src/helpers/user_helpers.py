from sqlalchemy.orm import Session
from sqlalchemy import select, text
from datetime import datetime

from ..models.user_model import User

from ..services.user_notification import create_system_notification

from ..models.ride_model import Ride,RideStatus
from ..utils.socket_manager import sio


def cancel_future_rides_for_vehicle(vehicle_id: str, db: Session, admin_id: str):
    db.execute(
        text("SET session.audit.user_id = :user_id"),
        {"user_id": str(admin_id) if admin_id else None}
    )

    now = datetime.utcnow()

    rides = (
        db.execute(
            select(Ride)
            .where(Ride.vehicle_id == vehicle_id)
            .where(Ride.start_datetime > now)
            .where(Ride.status != RideStatus.cancelled_due_to_no_show)
        )
    ).scalars().all()

    if not rides:
        return {
            "cancelled": 0,
            "users": []
        }

    affected_users = set()

    for ride in rides:
        ride.status = RideStatus.cancelled_vehicle_unavailable
        db.flush()

        affected_users.add(ride.user_id)

        title = "נסיעה בוטלה"
        message = "לצערנו הנסיעה שלך בוטלה בגלל שהרכב אינו זמין"

        create_system_notification(
            user_id=ride.user_id,
            title=title,
            message=message,
            order_id=ride.id
        )
    for user_id in affected_users:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.has_pending_rebook = True
            db.add(user)


    db.commit()

    return {
        "cancelled": len(rides),
        "users": list(affected_users)
    }