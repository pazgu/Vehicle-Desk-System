from pydantic import BaseModel, EmailStr
from uuid import UUID

class UserResponse(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    username: str
    email: EmailStr
    employee_id: str
    role: UserRole
    department_id: UUID

    class Config:
        orm_mode = True
