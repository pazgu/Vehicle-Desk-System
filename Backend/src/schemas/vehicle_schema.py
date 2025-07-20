from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime

from ..models.vehicle_model import FuelType, VehicleStatus, FreezeReason
from pydantic import BaseModel, Field

class VehicleOut(BaseModel):
    id: UUID
    plate_number: str
    type: str
    fuel_type: FuelType
    status: VehicleStatus
    freeze_reason: Optional[FreezeReason] = None
    freeze_details: Optional[str] = None
    last_used_at: Optional[datetime] = None
    current_location: str
    mileage: int
    mileage_last_updated: Optional[datetime] = None 
    vehicle_model: Optional[str] = None
    image_url: Optional[str] = None
    lease_expiry: Optional[datetime] = None  
    department_id: Optional[UUID] = None

    class Config:
        use_enum_values = True  # return enums as their values in JSON
        from_attributes = True  




class InUseVehicleOut(BaseModel):
    id: UUID
    plate_number: str
    type: str
    fuel_type: FuelType
    status: VehicleStatus
    mileage: float
    vehicle_model: Optional[str] = None  
    image_url: Optional[str] = None  
    current_location: Optional[str] = None 
    user_id: Optional[UUID] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None


class RideTimelineSchema(BaseModel):
    vehicle_id: UUID
    start_datetime: datetime
    end_datetime: datetime
    status: str
    user_id: UUID
    first_name: Optional[str] = None
    last_name: Optional[str] = None

    class Config:
        orm_mode = True



class VehicleStatusUpdate(BaseModel):
    new_status: VehicleStatus
    freeze_reason: Optional[FreezeReason] = None

class FreezeVehicleRequest(BaseModel):
    vehicle_id: UUID
    reason: str



class VehicleAvailabilityRequest(BaseModel):
    vehicle_type: str
    start_datetime: datetime
    end_datetime: datetime

class MileageUpdateRequest(BaseModel):
    new_mileage: int = Field(..., ge=0, description="New mileage must be zero or positive")