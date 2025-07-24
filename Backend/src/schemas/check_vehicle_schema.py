from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime



class IssueFoundSchema(BaseModel):
    vehicle_id: UUID
    issue_found: str


class VehicleInspectionSchema(BaseModel):
    inspection_id: Optional[UUID] = None
    inspection_date: Optional[datetime] = None
    inspected_by: Optional[UUID] = None

    dirty_vehicle_ids: Optional[List[UUID]] = None
    items_left_vehicle_ids: Optional[List[UUID]] = None
    critical_issue_vehicle_ids: Optional[List[UUID]] = None

   

    clean: bool
    fuel_checked: bool
    no_items_left: bool
    critical_issue_bool: bool = Field(default=False)
    issues_found: Optional[List[IssueFoundSchema]] = None

    class Config:
        from_attributes = True