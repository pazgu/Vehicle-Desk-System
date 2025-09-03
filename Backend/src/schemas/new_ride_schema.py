from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from enum import Enum
from typing import Optional, List

# ENUMS
class RideType(str, Enum):
    administrative = "administrative"
    operational = "operational"

class RideStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"

class RideCreate(BaseModel):
    user_id: UUID
    override_user_id: Optional[UUID] = None
    ride_type: RideType
    start_datetime: datetime
    vehicle_id: UUID
    end_datetime: datetime
    start_location: str
    stop: str
    destination: str
    estimated_distance_km: float
    actual_distance_km: float
    four_by_four_reason: Optional[str] = None
    target_type: Optional[str] = "self"  # "Self" or "Other"
    extra_stops: Optional[List[UUID]] = None 
    is_extended_request: Optional[bool] = False

    
class RideResponse(BaseModel):
    id: UUID
    user_id: UUID
    username: str
    vehicle_id: UUID
    ride_type: str
    start_datetime: datetime
    end_datetime: datetime
    start_location: str
    stop: str
    destination: str
    estimated_distance_km: float
    actual_distance_km: float
    four_by_four_reason: str | None = None
    status: str
    license_check_passed: bool
    submitted_at: datetime
    override_user_id: UUID | None = None
    plate_number: str
    extra_stops: Optional[List[UUID]] = None
    is_extended_request: Optional[bool] = False
    vehicle_model:Optional[str]= None

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: str
        }