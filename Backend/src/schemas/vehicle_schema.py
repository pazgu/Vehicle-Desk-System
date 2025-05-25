from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime

from ..models.vehicle_model import VehicleType, FuelType, VehicleStatus, FreezeReason  # adjust import path

class VehicleOut(BaseModel):
    id: UUID
    plate_number: str
    type: VehicleType
    fuel_type: FuelType
    status: VehicleStatus
    freeze_reason: Optional[FreezeReason] = None
    last_used_at: Optional[datetime] = None
    current_location: str
    odometer_reading: int
    vehicle_model: Optional[str] = None
    image_url: Optional[str] = None

    class Config:
        use_enum_values = True  # return enums as their values in JSON
        from_attributes = True  

        



class InUseVehicleOut(BaseModel):
    id: UUID
    plate_number: str
    type: VehicleType
    fuel_type: FuelType
    status: VehicleStatus
    odometer_reading: float
    vehicle_model: Optional[str] = None  
    image_url: Optional[str] = None  
    current_location: Optional[str] = None 
    user_id: Optional[UUID] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None


class VehicleStatusUpdate(BaseModel):
    new_status: VehicleStatus


