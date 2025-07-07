from sqlalchemy import Column, Enum, DateTime, ForeignKey, Text, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from src.models.base import Base
import enum
from datetime import datetime

class ApprovalRole(str, enum.Enum):
    supervisor = "supervisor"
    admin = "admin"

class ApprovalStatus(str, enum.Enum):
    approved = "approved"
    rejected = "rejected"

class RideApproval(Base):
    __tablename__ = "ride_approvals"

    ride_id = Column(UUID(as_uuid=True), ForeignKey("rides.id"), primary_key=True)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    role = Column(Enum(ApprovalRole), nullable=False)
    status = Column(Enum(ApprovalStatus), nullable=False)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    severity = Column(String, nullable=True)  # Should match the DB check constraint
    issue_description = Column(Text, nullable=True)
