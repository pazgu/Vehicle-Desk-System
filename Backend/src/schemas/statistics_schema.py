from pydantic import BaseModel
from uuid import UUID
from typing import List

class TopNoShowUser(BaseModel):
    user_id: UUID
    name: str
    department: str
    count: int

class NoShowStatsResponse(BaseModel):
    total_no_show_events: int
    unique_no_show_users: int
    top_no_show_users: List[TopNoShowUser]
