from sqlalchemy import Column, Integer, String, JSON, TIMESTAMP, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from src.models.base import Base
from datetime import datetime
import uuid

class RideRequirement(Base):
    __tablename__ = "ride_requirements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    items = Column(JSON, nullable=False)
    updated_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)
    updated_by = Column(UUID, ForeignKey("users.employee_id", ondelete="SET NULL"), nullable=True)