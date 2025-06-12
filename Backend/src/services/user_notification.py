from sqlalchemy.orm import Session
from uuid import UUID
from ..models.notification_model import Notification, NotificationType
from datetime import datetime, timezone
from ..models.notification_model import Notification, NotificationType
from ..utils.database import SessionLocal
from ..models.user_model import User  # adjust import if needed
from ..models.department_model import Department  # adjust import if needed
from fastapi import HTTPException, status
from ..models.ride_model import Ride
from ..utils.socket_manager import sio  # ✅ CORRECT
import asyncio



def get_user_notifications(db: Session, user_id: UUID):
    results = (
        db.query(Notification, Ride.status)
        .outerjoin(Ride, Ride.id == Notification.order_id)
        .filter(Notification.user_id == user_id)
        .all()
    )

    # Combine Notification and status into a dict per result
    notifications = []
    for notification, status in results:
        notif_dict = notification.__dict__.copy()
        notif_dict["order_status"] = status.value if status else None  # convert Enum to string
        notifications.append(notif_dict)

    return notifications

async def send_notification_async(
    db: Session,
    user_id: UUID,
    title: str,
    message: str,
    notification_type: NotificationType
):
    new_notification = await asyncio.to_thread(send_notification_async, db, user_id, title, message, notification_type)

    notif_data = {
        "id": str(new_notification.id),
        "title": title,
        "message": message,
        "notification_type": notification_type.value,
        "sent_at": new_notification.sent_at.isoformat(),
        "order_id": str(new_notification.order_id) if new_notification.order_id else None,
    }

    await sio.emit("new_notification", notif_data, room=str(user_id))
    print(f"📢 Emitted new_notification to room {user_id}")

    return new_notification





def create_system_notification(user_id, title, message, order_id=None):
    db = SessionLocal()
    try:
        notif = Notification(
            user_id=user_id,
            notification_type=NotificationType.system,
            title=title,
            message=message,
            sent_at=datetime.now(timezone.utc),
            order_id=order_id
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
        loop.run_in_executor(None, lambda: sio.emit("new_notification", {
            "id": str(notif.id),
            "title": notif.title,
            "message": notif.message,
            "notification_type": notif.notification_type.value,
            "sent_at": notif.sent_at.isoformat(),
            "order_id": str(notif.order_id) if notif.order_id else None,
        }, room=str(user_id)))

        return notif
    finally:
        db.close()



#this was created to be used in the completion form function since ->
# using the original create_system_notification is problematic 
def create_system_notification_with_db(db: Session, user_id, title, message, order_id=None):
    notif = Notification(
        user_id=user_id,
        notification_type=NotificationType.system,
        title=title,
        message=message,
        sent_at=datetime.now(timezone.utc),
        order_id=order_id
    )
    db.add(notif)
    return notif  # don't commit here — let caller handle it
def send_admin_odometer_notification(vehicle_id: UUID, odometer_reading: float):
    db = SessionLocal()
    try:
        admins = db.query(User).filter(User.role == 'admin').all()

        if not admins or odometer_reading < 10000:
            return None

        notifications = []
        for admin in admins:
            notif = Notification(
                user_id=admin.employee_id,
                notification_type=NotificationType.system,
                title="Vehicle Odometer Update",
                message=f"Vehicle {vehicle_id} has an odometer reading of {odometer_reading} km.",
                sent_at=datetime.now(timezone.utc)
            )
            db.add(notif)
            notifications.append(notif)

        db.commit()
        return notifications

    finally:
        db.close()







def get_supervisor_id(user_id: UUID, db: Session) -> UUID:
    # Step 1: Get user's department ID
    user = db.query(User).filter(User.employee_id == user_id).first()
    print(f"👤 User found: {user}")

    if not user:
        return None


    # Step 2: Get department's supervisor
    department = db.query(Department).filter(Department.id == user.department_id).first()
    if not department or not department.supervisor_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supervisor not found for this department.")

    return department.supervisor_id



def get_user_name(db: Session, user_id: str) -> str:
    user = db.query(User).filter(User.employee_id == user_id).first()
    if user:
        return user.full_name if hasattr(user, 'full_name') else user.username
    return "Unknown User"