from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID 

class AuditLogSchema(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: Optional[str]
    change_data: Optional[Dict[str, Any]]
    created_at: datetime
    changed_by: UUID
    checkbox_value: bool
    inspected_at: datetime
    # inspector_id: Optional[UUID]
    notes: Optional[str]

    class Config:
        from_attributes = True


class CreateAuditLogSchema(BaseModel):
    action: str
    entity_type: str
    entity_id: Optional[str]
    change_data: Optional[Dict[str, Any]]
    changed_by: UUID
    checkbox_value: bool
    inspected_at: datetime
    # inspector_id: Optional[UUID]
    notes: Optional[str]
