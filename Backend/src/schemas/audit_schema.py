from pydantic import BaseModel
from typing import Any,Optional
from datetime import datetime
from uuid import UUID

class AuditLogsSchema(BaseModel):
    id: int
    full_name: str
    action: str
    entity_type: str
    entity_id: str
    change_data: Any
    created_at: datetime
    changed_by: Optional[UUID]
