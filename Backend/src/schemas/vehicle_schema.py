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

    class Config:
        use_enum_values = True  # return enums as their values in JSON
