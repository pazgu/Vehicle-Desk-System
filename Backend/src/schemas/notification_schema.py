from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from enum import Enum
from typing import Optional

class NotificationType(str, Enum):
    email = "email"
    system = "system"

class NotificationOut(BaseModel):
    id: Optional[UUID]
    user_id: UUID
    notification_type: NotificationType
    title: str
    message: str
    sent_at: datetime
    order_id: Optional[UUID]
    order_status: Optional[str]
    vehicle_id: Optional[UUID]
    is_extended_request: Optional[bool] 
    seen: bool


    