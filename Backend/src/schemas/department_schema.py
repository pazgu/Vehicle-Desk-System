from pydantic import BaseModel
from uuid import UUID
from typing import Optional

class DepartmentCreate(BaseModel):
    name: str
    supervisor_id: UUID

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    supervisor_id: Optional[UUID] = None

class DepartmentOut(BaseModel):
    id: UUID
    name: str

    class Config:
        orm_mode = True
