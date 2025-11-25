from pydantic import BaseModel, EmailStr
from uuid import UUID
from enum import Enum
from pydantic import BaseModel, EmailStr
from typing import Optional , List
from uuid import UUID
from datetime import date, datetime


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
    phone: Optional[str] = None
    is_blocked: Optional[bool] = False  # Feild for blocking user
    block_expires_at: Optional[date] = None  # Optional, if user is blocked
    block_reason: Optional[str] = None

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
    is_blocked: bool = False
    block_expires_at: Optional[datetime] = None
    block_reason: Optional[str] = None
    is_unassigned_user: Optional[bool] = False
    class Config:
        from_attributes = True
        

class PaginatedUserResponse(BaseModel):
    total: int
    users: List[UserResponse]
