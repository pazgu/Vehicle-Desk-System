from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from uuid import UUID
from enum import Enum
from datetime import datetime

class VehicleInspectionSchema(BaseModel):
    ride_id: UUID
    vehicle_id: UUID
    inspection_date: Optional[datetime] = None
    inspected_by: Optional[UUID] 
    fuel_level: int = Field(..., ge=0, le=100)
    tires_ok: bool
    clean: bool
    issues_found: Optional[Dict[str, str]] = None 
