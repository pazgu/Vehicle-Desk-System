from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional
from enum import Enum

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
    start_datetime: datetime
    end_datetime: datetime
    destination: str

class RideCreate(BaseModel):
    ride_type: RideType
    start_datetime: datetime
    end_datetime: datetime
    start_location: str
    stop: str
    destination: str
    estimated_distance_km: float
    status: RideStatus = RideStatus.pending
    license_check_passed: bool = False
    submitted_at: datetime