

import uuid
from datetime import datetime
from sqlalchemy import Column, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from src.models.base import Base

class NoShowEvent(Base):
    __tablename__ = "no_show_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.employee_id"), nullable=False)
    ride_id = Column(UUID(as_uuid=True), ForeignKey("rides.id"), nullable=False)
    occurred_at = Column(DateTime, default=datetime.utcnow)

    
