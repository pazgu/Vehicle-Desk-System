from pydantic import BaseModel
from uuid import UUID
from typing import List, Optional
from datetime import date  


class TopNoShowUser(BaseModel):
    user_id: UUID
    name: str
    department_id: Optional[UUID] = None
    count: int
    email: Optional[str] = None
    role: Optional[str] = None
    employee_id: Optional[str] = None

class NoShowStatsResponse(BaseModel):
    total_no_show_events: int
    unique_no_show_users: int
    top_no_show_users: List[TopNoShowUser]
    
class RideStartTimeBucket(BaseModel):
    hour: int
    ride_count: int


class RideStartTimeStatsResponse(BaseModel):
    from_date: date
    to_date: date
    total_rides: int
    buckets: List[RideStartTimeBucket]

