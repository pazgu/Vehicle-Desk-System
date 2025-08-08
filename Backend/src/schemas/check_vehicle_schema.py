from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime



class IssueFoundSchema(BaseModel):
    vehicle_id: UUID
    issue_found: str


class VehicleInspectionSchema(BaseModel):
    inspection_id: Optional[UUID] = None
    inspected_by: Optional[UUID] = None

    dirty_vehicle_ids: Optional[List[UUID]] = None
    items_left_vehicle_ids: Optional[List[UUID]] = None
    critical_issue_vehicle_ids: Optional[List[UUID]] = None
    unfueled_vehicle_ids: Optional[List[UUID]] = None
    issues_found: Optional[List[IssueFoundSchema]] = None

    class Config:
        from_attributes = True