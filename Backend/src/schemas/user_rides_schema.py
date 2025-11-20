from pydantic import BaseModel
from enum import Enum
from datetime import datetime
from uuid import UUID
from typing import Optional, List


class RideStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"
    cancelled_due_to_no_show="cancelled_due_to_no_show"

class FuelType(str, Enum):
    electric = "electric"
    hybrid = "hybrid"
    gasoline = "gasoline"    
    
class RideSchema(BaseModel):
    ride_id: UUID
    ride_type: Optional[str]
    start_location: Optional[str]
    stop: Optional[str]
    extra_stops: Optional[List[UUID]]
    destination: Optional[str]
    start_datetime: datetime
    end_datetime: datetime
    estimated_distance: str
    status: RideStatus
    submitted_at: datetime
    user_id: UUID 
    vehicle: FuelType
    vehicle_type: str
    vehicle_model: str
    actual_pickup_time: Optional[datetime] = None
    extended_ride_reason: Optional[str] = None
    four_by_four_reason: Optional[str] = None

    class Config:
        from_attributes = True

