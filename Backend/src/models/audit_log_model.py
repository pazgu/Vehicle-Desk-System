from sqlalchemy import Column, String, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID as pgUUID
from uuid import uuid4
from datetime import datetime
from ..utils.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(pgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(String, nullable=True) 
    action = Column(String, nullable=False)  
    target_type = Column(String, nullable=False)  
    target_id = Column(String, nullable=True)  
    description = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
