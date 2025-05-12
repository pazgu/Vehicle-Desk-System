from pydantic import BaseModel
from enum import Enum
from datetime import datetime
# from ..schemas.new_ride_schema import RideStatus

class RideStatusEnum(str, Enum):
    pending = "Pending"
    approved = "Approved"
    rejected = "Rejected"

class FuelType(str, Enum):
    electric = "electric"
    hybrid = "hybrid"
    gasoline = "gasoline"    
    
class RideSchema(BaseModel):
    ride_id: str
    vehicle: FuelType
    start_datetime : datetime
    end_datetime: datetime
    estimated_distance: str
    status: RideStatusEnum

