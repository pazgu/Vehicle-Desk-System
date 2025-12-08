from datetime import datetime
from sqlalchemy import Column, ForeignKey, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from src.models.base import Base

class NoShowEvent(Base):
    __tablename__ = "no_show_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.employee_id"))
    ride_id = Column(UUID(as_uuid=True), ForeignKey("rides.id"))
    occurred_at = Column(TIMESTAMP(timezone=False), default=datetime.utcnow)

    user = relationship("User", back_populates="no_show_events")
    ride = relationship("Ride", back_populates="no_show_events")
