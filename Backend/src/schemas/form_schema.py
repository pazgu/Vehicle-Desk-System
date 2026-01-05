from pydantic import BaseModel
from typing import Optional
from uuid import UUID

class CompletionFormData(BaseModel):
    ride_id: UUID
    fueled: bool
    emergency_event: Optional[str] = None
    freeze_details:Optional[str] = None
    changed_by: str
    is_vehicle_ready_for_next_ride: bool
    