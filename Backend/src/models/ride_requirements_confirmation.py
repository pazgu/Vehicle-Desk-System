from sqlalchemy import Column, Boolean, TIMESTAMP, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from src.models.base import Base
from datetime import datetime
import uuid


class RideRequirementConfirmation(Base):
    __tablename__ = "ride_requirements_confirmations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ride_id = Column(UUID(as_uuid=True), ForeignKey("rides.id", ondelete="CASCADE"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.employee_id", ondelete="CASCADE"))
    confirmed = Column(Boolean, nullable=False, default=False)
    confirmed_at = Column(TIMESTAMP, default=datetime.utcnow)
