from pydantic import BaseModel
from typing import Any
from datetime import datetime

class AuditLogsSchema(BaseModel):
    id: int
    full_name: str
    action: str
    entity_type: str
    entity_id: str
    change_data: Any
    created_at: datetime
    changed_by: str
