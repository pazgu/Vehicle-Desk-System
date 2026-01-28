from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, text
from datetime import datetime, timezone

from ..models.user_model import User

from ..services.user_notification import create_system_notification

from ..models.ride_model import Ride,RideStatus
from ..utils.socket_manager import sio



def cancel_future_rides_for_vehicle(
    vehicle_id: str,
    db: Session,
    admin_id: str,
    freeze_reason: str = None,
    freeze_details: str = None,
    current_ride_id: str = None, 
):
    db.execute(
        text("SET session.audit.user_id = :user_id"),
        {"user_id": str(admin_id) if admin_id else None}
    )

    now = datetime.utcnow()

    query = select(Ride).where(
        Ride.vehicle_id == vehicle_id,
        Ride.start_datetime > now,
        Ride.status != RideStatus.cancelled_due_to_no_show
    )

    if current_ride_id:
        query = query.where(Ride.id != current_ride_id)

    rides = db.execute(query).scalars().all()

    if not rides:
        return {"cancelled": 0, "users": [], "notifications": []}

    affected_users = set()
    notifications_to_emit = []

    freeze_reason_map = {
        "accident": "תאונה",
        "maintenance": "תחזוקה",
        "personal": "אישי"
    }
    freeze_reason_text = freeze_reason_map.get(freeze_reason, freeze_reason) if freeze_reason else "לא זמין"
    
    cancellation_reason = f"הרכב הוקפא - {freeze_reason_text}"
    if freeze_details:
        cancellation_reason += f": {freeze_details}"

    for ride in rides:
        ride.status = RideStatus.cancelled_vehicle_unavailable
        ride.emergency_event = cancellation_reason
        ride.vehicle_id = None
        db.flush()

        affected_users.add(ride.user_id)

        title = "נסיעה בוטלה"
        message = f"לצערנו הנסיעה שלך בוטלה. {cancellation_reason}"

        notif = create_system_notification(
            user_id=ride.user_id,
            title=title,
            message=message,
            order_id=ride.id
        )
        notifications_to_emit.append({
            'id': str(notif.id),
            'user_id': str(notif.user_id),
            'title': notif.title,
            'message': notif.message,
            'notification_type': notif.notification_type.value,
            'sent_at': notif.sent_at.isoformat(),
            'order_id': str(ride.id),
            'seen': False
        })

    for user_id in affected_users:
        user = db.query(User).filter(User.employee_id == user_id).first()
        if user:
            user.has_pending_rebook = True
            db.add(user)

    db.commit()

    return {
        "cancelled": len(rides), 
        "users": list(affected_users),
        "notifications": notifications_to_emit
    }



async def cancel_future_rides_for_vehicle_with_socket(
    vehicle_id: str,
    db: Session,
    admin_id: str,
    freeze_reason: str = None,
    freeze_details: str = None,
    current_ride_id: str = None,
):  
    result = cancel_future_rides_for_vehicle(
        vehicle_id, db, admin_id, freeze_reason, freeze_details, current_ride_id
    )
    
    for notif_data in result.get("notifications", []):
        await sio.emit('new_notification', notif_data, room=notif_data['user_id'])
    
    return result


def update_user_pending_rebook_status(db, user_id: int):
    now = datetime.now(timezone.utc)

    user = db.query(User).filter(User.employee_id == user_id).first()
    if not user:
        return None

    pending_rides = db.query(Ride).filter(
        Ride.user_id == user_id,
        Ride.status == RideStatus.cancelled_vehicle_unavailable,
        Ride.start_datetime > now   
    ).count()

    user.has_pending_rebook = pending_rides > 0

    db.commit()
    db.refresh(user)

    return user.has_pending_rebook


