from pydantic import BaseModel
from enum import Enum
from datetime import datetime
from uuid import UUID
# from ..schemas.new_ride_schema import RideStatus

class RideStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"

class FuelType(str, Enum):
    electric = "electric"
    hybrid = "hybrid"
    gasoline = "gasoline"    
    
class RideSchema(BaseModel):
    ride_id: UUID
    vehicle: FuelType
    start_datetime : datetime
    end_datetime: datetime
    estimated_distance: str
    status: RideStatus
    submitted_at: datetime

