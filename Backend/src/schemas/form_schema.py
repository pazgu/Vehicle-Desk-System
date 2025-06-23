from pydantic import BaseModel
from typing import Optional
from uuid import UUID
class CompletionFormData(BaseModel):
    ride_id: UUID
    completed: bool 
    fueled: bool
    emergency_event: Optional[str] = None
    freeze_details:Optional[str] = None
    changed_by: str
    