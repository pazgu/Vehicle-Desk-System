from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy.dialects.postgresql import UUID

class AuditLogSchema(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: Optional[str]
    change_data: Optional[Dict[str, Any]]
    created_at: datetime
    changed_by: UUID

    class Config:
        orm_mode = True

class CreateAuditLogSchema(BaseModel):
    action: str
    entity_type: str
    entity_id: Optional[str]
    change_data: Optional[Dict[str, Any]]
    changed_by: UUID
