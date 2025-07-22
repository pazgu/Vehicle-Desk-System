from pydantic import BaseModel, EmailStr
from uuid import UUID
from enum import Enum
# app/schemas.py
from pydantic import BaseModel, EmailStr
from typing import Optional , List
from uuid import UUID
from datetime import date


class UserRole(str, Enum):
    employee = "employee"
    supervisor = "supervisor"
    admin = "admin"
    inspector = 'inspector'

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None 
    department_id: Optional[UUID] = None
    password: Optional[str] = None
    has_government_license: bool 
    license_file_url: Optional[str] = None
    license_expiry_date: Optional[date] = None

class UserResponse(BaseModel):
    first_name: str
    last_name: str
    username: str
    email: EmailStr
    employee_id: UUID
    role: UserRole
    department_id: Optional[UUID]
    has_government_license: bool
    license_file_url: Optional[str] = None
    license_expiry_date: Optional[date] = None
    phone: Optional[str] = None 
    class Config:
        from_attributes = True
        

class PaginatedUserResponse(BaseModel):
    total: int
    users: List[UserResponse]
