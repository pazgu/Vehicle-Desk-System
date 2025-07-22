from pydantic import BaseModel
from uuid import UUID
from typing import List, Optional

class TopNoShowUser(BaseModel):
    user_id: UUID
    name: str
    department: Optional[str] = None 
    count: int

class NoShowStatsResponse(BaseModel):
    total_no_show_events: int
    unique_no_show_users: int
    top_no_show_users: List[TopNoShowUser]
