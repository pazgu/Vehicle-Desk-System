from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime

class IssueFoundSchema(BaseModel):
    vehicle_id: UUID
    issue_found: str


class VehicleInspectionSchema(BaseModel):
    inspected_by: UUID
    vehicle_id: UUID
    is_clean: bool
    is_unfueled: bool
    has_items_left: bool
    has_critical_issue: bool
    issues_found: Optional[str] = None