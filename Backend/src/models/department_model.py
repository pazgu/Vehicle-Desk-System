from sqlalchemy import Column, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from src.models.base import Base
import uuid

class Department(Base):
    __tablename__ = "departments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(Text, nullable=False, unique=True)
    supervisor_id = Column(UUID(as_uuid=True), ForeignKey("users.employee_id"), nullable=False)

    