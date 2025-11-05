from pydantic import BaseModel, EmailStr
from uuid import UUID
from enum import Enum
from typing import Optional
from datetime import date


class UserRole(str, Enum):
    employee = "employee"
    supervisor = "supervisor"
    admin = "admin"
    inspector = 'inspector'

class UserCreate(BaseModel):
    first_name: str
    last_name: str
    username: str
    email: EmailStr
    employee_id: Optional[UUID] = None 
    role: UserRole
    phone: Optional[str] = None
    department_id: Optional[UUID]
    password: str
    has_government_license: bool = False
    license_file_url: Optional[str] = None
    license_expiry_date: Optional[date] = None

