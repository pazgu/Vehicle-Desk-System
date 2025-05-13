from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from enum import Enum

class NotificationType(str, Enum):
    email = "email"
    system = "system"

class NotificationOut(BaseModel):
    id: UUID
    user_id: UUID
    notification_type: NotificationType
    title: str
    message: str
    sent_at: datetime