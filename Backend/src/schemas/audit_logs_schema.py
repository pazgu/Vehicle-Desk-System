from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID  # Use Python's standard UUID
# (you don’t need sqlalchemy.dialects.postgresql.UUID in Pydantic models)

class AuditLogSchema(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: Optional[str]
    change_data: Optional[Dict[str, Any]]
    created_at: datetime
    changed_by: UUID

    # New fields
    checkbox_values: Optional[Dict[str, Any]]  # Store checkbox info as a JSON/dict
    inspected_at: Optional[datetime]
    inspector_id: Optional[UUID]
    inspection_notes: Optional[str]

    class Config:
        from_attributes = True


class CreateAuditLogSchema(BaseModel):
    action: str
    entity_type: str
    entity_id: Optional[str]
    change_data: Optional[Dict[str, Any]]
    changed_by: UUID

    # New fields
    checkbox_values: Optional[Dict[str, Any]]
    inspected_at: Optional[datetime]
    inspector_id: Optional[UUID]
    inspection_notes: Optional[str]
