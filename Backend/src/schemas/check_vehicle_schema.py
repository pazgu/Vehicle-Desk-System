from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from uuid import UUID

class VehicleInspectionSchema(BaseModel):
    ride_id: UUID
    vehicle_id: UUID
    inspected_by: Optional[UUID]  # מזהה המשתמש שבדק את הרכב
    fuel_level: int = Field(..., ge=0, le=100)
    tires_ok: bool
    clean: bool
    issues_found: Optional[Dict[str, str]] = None  # לדוג' {"window": "cracked"}
