from pydantic import BaseModel, EmailStr
from uuid import UUID
from enum import Enum
# app/schemas.py
from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID


class UserRole(str, Enum):
    employee = "employee"
    supervisor = "supervisor"
    admin = "admin"
    inspector = "inspector"

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None   # <-- Use the Enum here
    department_id: Optional[UUID] = None
    password: Optional[str] = None

class UserResponse(BaseModel):
    first_name: str
    last_name: str
    username: str
    email: EmailStr
    employee_id: UUID
    role: UserRole
    department_id: UUID
    
    class Config:
        from_attributes = True
