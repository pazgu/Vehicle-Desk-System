from sqlalchemy.orm import Session
from uuid import UUID
from ..models.notification_model import Notification, NotificationType
from datetime import datetime

def get_user_notifications(db: Session, user_id: UUID):
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.sent_at.desc())
        .all()
    )


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

