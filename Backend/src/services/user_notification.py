from sqlalchemy.orm import Session
from uuid import UUID
from ..models.notification_model import Notification

def get_user_notifications(db: Session, user_id: UUID):
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.sent_at.desc())
        .all()
    )