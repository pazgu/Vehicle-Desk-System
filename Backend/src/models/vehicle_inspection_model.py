from sqlalchemy import Column, DateTime, ForeignKey, Integer, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from src.models.base import Base
import uuid
from datetime import datetime

class VehicleInspection(Base):
    __tablename__ = "vehicle_inspections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=False)
    inspection_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    inspected_by = Column(UUID(as_uuid=True), ForeignKey("users.employee_id"), nullable=True)
    fuel_level = Column(Integer, nullable=False)
    tires_ok = Column(Boolean, nullable=False)
    clean = Column(Boolean, nullable=False)
    issues_found = Column(JSONB, nullable=True)  # אפשר גם לשנות ל-Text אם את מעדיפה

    