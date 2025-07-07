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
    id: str
    inspection_id: Optional[UUID]
    ride_id: Optional[UUID]
    approved_by: UUID
    submitted_by: Optional[UUID]
    role: str
    type: Optional[str]
    status: str
    severity: Optional[str]
    issue_description: Optional[str]
    issue_text: Optional[str]
    timestamp: datetime
    vehicle_info: Optional[str]
    inspection_details: Optional[Dict[str, Any]] = None

    class Config:
        orm_mode = True
        
