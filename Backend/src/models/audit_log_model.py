from sqlalchemy import Column, String, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID as pgUUID
from uuid import uuid4
from datetime import datetime
from ..utils.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)  
    action = Column(Text, nullable=False)
    entity_type = Column(Text, nullable=False)
    entity_id = Column(String, nullable=True)
    change_data = Column(JSON, nullable=True)  
    created_at = Column(DateTime, default=datetime.utcnow)
