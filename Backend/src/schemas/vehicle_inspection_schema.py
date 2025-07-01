from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime

class VehicleInspectionOut(BaseModel):
    inspection_id: Optional[UUID]
    inspection_date: Optional[datetime]
    inspected_by: Optional[UUID]
    clean: bool
    fuel_checked: bool
    no_items_left: bool
    critical_issue_bool: bool
    issues_found: Optional[str]

    class Config:
        orm_mode = True