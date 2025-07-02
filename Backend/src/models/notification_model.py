from sqlalchemy import Column, Text, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from src.models.base import Base
import enum
import uuid
from datetime import datetime,timezone

class NotificationType(str, enum.Enum):
    email = "email"
    system = "system"

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.employee_id"), nullable=False)
    notification_type = Column(Enum(NotificationType), nullable=False)
    title = Column(Text, nullable=False)
    message = Column(Text, nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    order_id = Column(UUID(as_uuid=True), ForeignKey("rides.id"), nullable=True)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=True)  # ✅

    # Relationship to Ride (order)
    ride = relationship("Ride", back_populates="notifications", lazy="joined", uselist=False)
    


    