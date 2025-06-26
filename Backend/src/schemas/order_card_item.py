from pydantic import BaseModel
from datetime import datetime
from typing import Optional,List
from .ride_status_enum import RideStatusEnum  # Relative import
from uuid import UUID



class OrderCardItem(BaseModel):
    id: UUID
    user_id: UUID
    vehicle_id: Optional[UUID] = None
    ride_type: str
    start_datetime: datetime
    end_datetime: datetime
    start_location: str
    stop: str
    destination: str
    estimated_distance_km: float
    actual_distance_km:  Optional[float] = None
    status: RideStatusEnum
    license_check_passed: Optional[bool] = None
    submitted_at: datetime
    emergency_event: Optional[str] = None  # Optional field for emergency event
    extra_stops: Optional[List[UUID]] = None 
    class Config:
        from_attributes = True