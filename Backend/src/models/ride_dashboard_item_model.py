from sqlalchemy import Column, String, Integer, Text, Enum, Boolean, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from src.models.base import Base
import enum
import uuid
from sqlalchemy.sql import func
from ..models.ride_model import RideStatus

class DashboardItem(Base):
    __tablename__ = "rides"

    id = Column(Integer, primary_key=True, index=True)
    employee_name = Column(Text, ForeignKey("users.employee_id"), nullable=False)
    vehicle_plate = Column(int, ForeignKey("vehicles.id"), nullable=False)
    start_datetime = Column(DateTime, nullable=False)
    destination = Column(Text, nullable=False)
    estimated_distance_km = Column(Numeric, nullable=False)
    status = Column(Enum(RideStatus), default=RideStatus.pending, nullable=False)
