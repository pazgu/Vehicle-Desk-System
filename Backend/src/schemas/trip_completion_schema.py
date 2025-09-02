from pydantic import BaseModel
from uuid import UUID
from typing import Any, Dict, Optional
from datetime import datetime

class TripCompletionIssueSchema(BaseModel):
    ride_id: Optional[UUID]  
    approved_by: UUID
    role: str
    status: str
    severity: Optional[str]
    issue_description: Optional[str]
    timestamp: datetime

    class Config:
        orm_mode = True
        

class RawCriticalIssueSchema(BaseModel):
    inspection_id: UUID
    inspection_date: datetime

    inspected_by: Optional[UUID]
    inspector_name: Optional[str]  

    critical_issue_vehicle_id: Optional[UUID]
    critical_issue_bool: bool
    issues_found: Optional[str]

    class Config:
        orm_mode = True


