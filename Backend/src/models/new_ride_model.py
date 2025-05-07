from sqlalchemy import Column, String, Integer, Text, Enum, Boolean, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database import Base
import enum
import uuid

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

class Ride(Base):
    __tablename__ = "rides"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=False)
    ride_type = Column(Enum(RideType), nullable=False)
    start_datetime = Column(DateTime, nullable=False)
    end_datetime = Column(DateTime, nullable=False)
    start_location = Column(Text, nullable=False)
    stop = Column(Text, nullable=False)
    destination = Column(Text, nullable=False)
    estimated_distance_km = Column(Numeric, nullable=False)
    status = Column(Enum(RideStatus), default=RideStatus.pending, nullable=False)
    license_check_passed = Column(Boolean, default=False)
    submitted_at = Column(DateTime, nullable=False)
    emergency_event = Column(Text, nullable=True)