from sqlalchemy import Column, Enum, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from src.models.base import Base
import enum
import uuid
from datetime import datetime

class RideEventType(str, enum.Enum):
    entry = "entry"
    exit = "exit"
    key_pickup = "key_pickup"
    key_return = "key_return"
    lpr_entry = "lpr_entry"
    lpr_exit = "lpr_exit"

class RideLog(Base):
    __tablename__ = "ride_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ride_id = Column(UUID(as_uuid=True), ForeignKey("rides.id"), nullable=False)
    event_type = Column(Enum(RideEventType), nullable=False)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    data = Column(JSONB, nullable=True)

    