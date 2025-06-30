# schemas/vehicle_schema.py

from pydantic import BaseModel, HttpUrl
from typing import Optional
from datetime import datetime
from uuid import UUID
from ..models.vehicle_model import  FuelType, VehicleStatus, FreezeReason

class VehicleCreate(BaseModel):
    plate_number: str
    type: str
    fuel_type: FuelType
    status: Optional[VehicleStatus] = VehicleStatus.available
    freeze_reason: Optional[FreezeReason] = None
    freeze_details: Optional[str] = None
    last_used_at: Optional[datetime] = None
    current_location: str
    odometer_reading: int
    vehicle_model: str
    image_url: Optional[str] = None
    lease_expiry: datetime
