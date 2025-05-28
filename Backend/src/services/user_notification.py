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


def send_notification(
    db: Session,
    user_id: UUID,
    title: str,
    message: str,
    notification_type: NotificationType
) -> Notification:
    new_notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        sent_at=datetime.utcnow()
    )
    db.add(new_notification)
    db.commit()
    db.refresh(new_notification)
    return new_notification



def create_system_notification(user_id, title, message, order_id=None):
    db = SessionLocal()
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
    db.close()
    return notif


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