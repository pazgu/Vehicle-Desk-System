from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class AuditLogSchema(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: Optional[str]
    change_data: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True

class CreateAuditLogSchema(BaseModel):
    action: str
    entity_type: str
    entity_id: Optional[str]
    change_data: Optional[Dict[str, Any]]
