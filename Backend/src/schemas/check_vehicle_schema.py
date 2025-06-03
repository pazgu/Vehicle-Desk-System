from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from uuid import UUID
from enum import Enum
from datetime import datetime

class VehicleInspectionSchema(BaseModel):
    ride_id: Optional[UUID] = None
    inspection_date: Optional[datetime] = None
    inspected_by: Optional[UUID] 
    fuel_level: bool
    tires_ok: bool
    clean: bool
    issues_found: Optional[Dict[str, str]] = None 
