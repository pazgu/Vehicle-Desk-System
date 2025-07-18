from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, Enum, Boolean, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID,ARRAY
from sqlalchemy.orm import relationship
from src.models.base import Base
import enum
import uuid
from sqlalchemy.sql import func
from pydantic import BaseModel
import uuid
from sqlalchemy.orm import relationship

class RideType(str, enum.Enum):
    administrative = "administrative"
    operational = "operational"

class RideStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"
    cancelled_due_to_no_show = "cancelled_due_to_no_show"  
    reserved = "reserved"

class Ride(Base):
    __tablename__ = "rides"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, unique=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.employee_id"), nullable=False)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=False)
    ride_type = Column(Enum(RideType), nullable=False, index=True)
    start_datetime = Column(DateTime, nullable=False, index=True)
    actual_pickup_time = Column(DateTime(timezone=True), nullable=True)
    end_datetime = Column(DateTime, nullable=False, index=True)
    start_location = Column(Text, nullable=False)
    stop = Column(Text, nullable=False)
    extra_stops = Column(ARRAY(UUID), nullable=True)
    destination = Column(Text, nullable=False)
    estimated_distance_km = Column(Numeric, nullable=False)
    actual_distance_km = Column(Numeric, nullable=False)
    four_by_four_reason = Column(Text, nullable=True)  
    status = Column(Enum(RideStatus), default=RideStatus.pending, nullable=False, index=True)
    license_check_passed = Column(Boolean, default=False)
    submitted_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc))
    emergency_event = Column(Text, nullable=True) 
    
    notifications = relationship("Notification", back_populates="ride", lazy="dynamic")
    is_archive = Column(Boolean, default=False, name="isArchive")
    override_user_id = Column(UUID(as_uuid=True), ForeignKey("users.employee_id"), nullable=True)
    feedback_submitted= Column(Boolean, default=False) 
    rejection_reason = Column(Text, nullable=True)
    
    no_show_events = relationship("NoShowEvent", back_populates="ride")


class PendingRideSchema(BaseModel):
    vehicle_id: uuid.UUID  # ✅ Use this, not sqlalchemy.UUID
    ride_period: str  # 'morning' or 'night'
    ride_date: str    # 'YYYY-MM-DD'
    ride_date_night_end: str | None
    start_time: str   # 'HH:mm'
    end_time: str     # 'HH:mm'
    feedback_submitted: bool = False 

    class Config:
        from_attributes = True