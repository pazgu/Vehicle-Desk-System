from pydantic import BaseModel
from enum import Enum
from datetime import datetime
# from ..schemas.new_ride_schema import RideStatus

class RideStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"
    
class FutureRides(BaseModel):
    ride_id: str
    vehicle: str
    start_datetime : datetime
    end_datetime: datetime
    purpose: str
    estimated_distance: str
    status: RideStatus

