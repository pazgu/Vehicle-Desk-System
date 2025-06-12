from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from uuid import UUID
from enum import Enum
from datetime import datetime

class VehicleInspectionSchema(BaseModel):   
    inspection_id: Optional[UUID] = None
    inspection_date: datetime = None
    inspected_by: UUID = None 
    # fuel_level: bool
    # tires_ok: bool
    clean: bool
    fuel_checked: bool
    no_items_left: bool
    critical_issue_bool: bool = Field(default=False)
    issues_found: Optional[str] = None 
