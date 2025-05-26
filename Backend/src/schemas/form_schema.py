from pydantic import BaseModel
from typing import Optional
class CompletionFormData(BaseModel):
    ride_id: int
    completed: bool 
    fueled: bool
    emergency_event: Optional[str] = None