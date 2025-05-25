from pydantic import BaseModel, EmailStr
from uuid import UUID
from enum import Enum

class UserRole(str, Enum):
    employee = "employee"
    supervisor = "supervisor"
    admin = "admin"
    
class UserResponse(BaseModel):
    first_name: str
    last_name: str
    username: str
    email: EmailStr
    employee_id: UUID
    role: UserRole
    department_id: UUID
    
    class Config:
        orm_mode = True
