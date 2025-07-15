from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class VehicleInspectionSchema(BaseModel):
    inspection_id: Optional[UUID] = None
    inspection_date: Optional[datetime] = None
    inspected_by: Optional[UUID] = None

    clean: bool
    fuel_checked: bool
    no_items_left: bool
    critical_issue_bool: bool = Field(default=False)
    issues_found: Optional[str] = None
    class Config:
        from_attributes = True