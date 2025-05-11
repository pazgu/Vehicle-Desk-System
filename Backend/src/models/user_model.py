import uuid
from sqlalchemy import Column, String, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from src.models.base import Base
import enum

class UserRole(str, enum.Enum):
    employee = 'employee'
    supervisor = 'supervisor'
    admin = 'admin'

class User(Base):
    __tablename__ = 'users'  
    
    
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    username = Column(String, nullable=False, unique=True)
    email = Column(String, nullable=False, unique=True)
    employee_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    password = Column(String, nullable=False)  # hashing afterwards
    role = Column(Enum(UserRole), nullable=False)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=False)