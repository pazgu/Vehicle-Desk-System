from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime


class RideRequirementBase(BaseModel):
    items: List[str]


class RideRequirementCreate(RideRequirementBase):
    updated_by: Optional[UUID] = None


class RideRequirementUpdate(BaseModel):
    items: List[str]         
    updated_by: Optional[UUID] = None  

    class Config:
        orm_mode = True


        
class RideRequirementOut(RideRequirementBase):
    id: UUID
    updated_at: datetime
    updated_by: Optional[UUID]

    class Config:
        orm_mode = True
