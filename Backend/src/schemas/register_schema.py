from pydantic import BaseModel, EmailStr
from uuid import UUID
from enum import Enum
from typing import Optional


class UserRole(str, Enum):
    employee = "employee"
    supervisor = "supervisor"
    admin = "admin"

class UserCreate(BaseModel):
    first_name: str
    last_name: str
    username: str
    email: EmailStr
    employee_id: Optional[UUID] = None 
    role: UserRole
    department_id: UUID
    password: str  # important: this is usually hashed before storing
