from fastapi import APIRouter
from enum import Enum

router = APIRouter()

class UserRole(str, Enum):
    employee = "employee"
    supervisor = "supervisor"
    admin = "admin"