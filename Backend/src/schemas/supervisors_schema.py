from pydantic import BaseModel
from uuid import UUID

class SupervisorOut(BaseModel):
    id: UUID
    name: str
