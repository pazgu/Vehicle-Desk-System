import uuid
from sqlalchemy import Column, String, Enum, ForeignKey , Boolean , Date
from sqlalchemy.dialects.postgresql import UUID
from src.models.base import Base
import enum
from sqlalchemy.orm import relationship

class UserRole(str, enum.Enum):
    anonymous = "anonymous"
    employee = 'employee'
    supervisor = 'supervisor'
    admin = 'admin'
    inspector = 'inspector'

class User(Base):
    __tablename__ = 'users'  

    
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    username = Column(String, nullable=False, unique=True)
    phone = Column(String(20), nullable=True)
    email = Column(String, nullable=False, unique=True)
    employee_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    password = Column(String, nullable=False)  # hashing afterwards
    role = Column(Enum(UserRole), nullable=False)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=False)
    has_government_license = Column(Boolean, default=False)
    license_file_url = Column(String, nullable=True)
    license_expiry_date = Column(Date, nullable=True)
    

    no_show_events = relationship("NoShowEvent", back_populates="user")
