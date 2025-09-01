import asyncio
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models.department_model import Department
from ..models.notification_model import Notification, NotificationType
from ..models.ride_model import Ride, RideStatus
from ..models.user_model import User
from ..models.vehicle_model import Vehicle
from ..schemas.notification_schema import NotificationOut
from ..utils.database import SessionLocal
from ..utils.socket_manager import sio

def get_user_notifications(db: Session, user_id: UUID):
    results = (
        db.query(Notification, Ride.status, Ride.start_datetime, Ride.end_datetime)
        .outerjoin(Ride, Ride.id == Notification.order_id)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.sent_at.desc())
        .all()
    )

    notifications = []
    for notification, status, start_dt, end_dt in results:
        notif_dict = notification.__dict__.copy()
        notif_dict["order_status"] = status.value if status else None
        
        # Detect long ride (>2 days) for ride-related notifications
        is_extended = False
        if start_dt and end_dt:
            is_extended = (end_dt - start_dt) > timedelta(days=2)
        
        notif_dict["is_extended_request"] = is_extended  # ✅ add flag
        
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

    return new_notification





def create_system_notification(user_id, title, message, order_id=None,vehicle_id=None,relevant_user_id=None):
    db = SessionLocal()
    try:
        notif = Notification(
            user_id=user_id,
            notification_type=NotificationType.system,
            title=title,
            message=message,
            sent_at=datetime.now(timezone.utc),
            order_id=order_id,
            vehicle_id=vehicle_id,
            relevant_user_id=relevant_user_id
        
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
            "vehicle_id": str(notif.vehicle_id) if notif.vehicle_id else None,
            "relevant_user_id": str(notif.relevant_user_id) if notif.relevant_user_id else None,
        }, room=str(user_id)))

        return notif
    finally:
        db.close()



#this was created to be used in the completion form function since ->
# using the original create_system_notification is problematic 
def create_system_notification_with_db(db: Session, user_id, title, message, order_id=None,vehicle_id=None):
    notif = Notification(
        user_id=user_id,
        notification_type=NotificationType.system,
        title=title,
        message=message,
        sent_at=datetime.now(timezone.utc),
        order_id=order_id,
        vehicle_id=vehicle_id
    )
    db.add(notif)
    return notif  # don't commit here — let caller handle it

async def send_admin_odometer_notification(vehicle_id: UUID, mileage: float):
    db = SessionLocal()
    try:
        admins = db.query(User).filter(User.role == 'admin').all()
        if not admins or mileage < 10000:
            return None

        plate_number = None
        if vehicle_id:
            plate_number = (
                db.query(Vehicle.plate_number)
                .filter(Vehicle.id == vehicle_id)
                .scalar()
            )

        notifications = []
        for admin in admins:
            exists_admin = db.query(Notification).filter(
                Notification.user_id == admin.employee_id,
                Notification.vehicle_id == vehicle_id,
                Notification.title == "Vehicle Odometer Update"
            ).first()
            if not exists_admin:
                notif = Notification(
                    user_id=admin.employee_id,
                    notification_type=NotificationType.system,
                    title="Vehicle Odometer Update",
                    message=f"{plate_number} לרכב עם מספר רישוי ק״מ {mileage} יש מד אוץ של ",
                    sent_at=datetime.now(timezone.utc),
                    vehicle_id=vehicle_id
                )
                db.add(notif)
                notifications.append(notif)

        db.commit()

        if notifications:
            for notif in notifications:
                await sio.emit(
                    "new_odometer_notification",
                    {"updated_notifications": [notif.to_dict()]},
                    room=str(notif.user_id)
                )

        return notifications
    except Exception as e:
        print(f"Exception in send_admin_odometer_notification: {e}")
    finally:
        db.close()







def get_supervisor_id(user_id: UUID, db: Session) -> UUID | None:
    user = db.query(User).filter(User.employee_id == user_id).first()
    if not user:
        return None

    # הנחה: יש לך טבלה/מודל Department עם שדה supervisor_id
    department = db.query(Department).filter(Department.id == user.department_id).first()
    if not department:
        return None

    return department.supervisor_id




def get_user_name(db: Session, user_id: UUID) -> str:
    user = db.query(User).filter(User.employee_id == user_id).first()
    if user:
        return user.full_name if hasattr(user, 'full_name') else user.username
    return "Unknown User"



async def emit_new_notification(
    notification: NotificationOut,
    order_status: RideStatus = None,
    vehicle_id: str = None
):
    payload = {
        "id": str(notification.id),
        "user_id": str(notification.user_id),
        "title": notification.title,
        "message": notification.message,
        "notification_type": notification.notification_type.value,
        "sent_at": notification.sent_at.isoformat(),
        "order_id": str(notification.order_id) if notification.order_id else None,
        "order_status": order_status.value if order_status else None,
        "vehicle_id": str(vehicle_id) if vehicle_id else None
    }

    await sio.emit("new_notification", payload,room=str(notification.user_id))
