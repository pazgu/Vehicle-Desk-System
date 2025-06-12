import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.models.base import Base


class VehicleInspection(Base):
    __tablename__ = "vehicle_inspections"

    inspection_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inspection_date = Column(DateTime, nullable=False, default=datetime.now(timezone.utc))

    # Foreign key to users table
    inspected_by = Column(UUID(as_uuid=True), ForeignKey("users.employee_id"), nullable=True)

    # Inspection details
    clean = Column(Boolean, nullable=False)
    fuel_checked = Column(Boolean, nullable=False)
    no_items_left = Column(Boolean, nullable=False)
    critical_issue_bool = Column(Boolean, nullable=False, default=False)
    issues_found = Column(Text, nullable=True)
