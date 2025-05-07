from pydantic import BaseModel, EmailStr
from uuid import UUID
from enum import Enum

class UserRole(str, Enum):
    employee = "employee"
    supervisor = "supervisor"
    admin = "admin"

class UserCreate(BaseModel):
    first_name: str
    last_name: str
    username: str
    email: EmailStr
    employee_id: str
    role: UserRole
    department_id: UUID
    password: str  # important: this is usually hashed before storing
