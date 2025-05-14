from sqlalchemy import Column, String, Integer, Text, Enum, Boolean, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from src.models.base import Base
import enum
import uuid
from sqlalchemy.sql import func


class Order(Base):
    __tablename__ = "rides"

    id = Column(UUID, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.employee_id"), nullable=False)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=False)
    ride_type = Column(Enum(RideType), nullable=False)
    start_datetime = Column(DateTime, nullable=False)
    end_datetime = Column(DateTime, nullable=False)
    start_location = Column(Text, nullable=False)
    stop = Column(Text, nullable=False)
    destination = Column(Text, nullable=False)
    estimated_distance_km = Column(Numeric, nullable=False)
    actual_distance_km = Column(Numeric, nullable=False)
    status = Column(Enum(RideStatus), default=RideStatus.pending, nullable=False)
    license_check_passed = Column(Boolean, default=False)
    submitted_at = Column(DateTime, nullable=False, server_default=func.now())
    emergency_event = Column(Text, nullable=True)