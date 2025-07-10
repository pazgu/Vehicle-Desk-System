from sqlalchemy import Column, String, Integer, Text, Enum, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from src.models.base import Base
import enum
import uuid

# class VehicleType(str, enum.Enum):
#     small = "small"
#     large = "large"
#     van = "van"

class FuelType(str, enum.Enum):
    electric = "electric"
    hybrid = "hybrid"
    gasoline = "gasoline"

class VehicleStatus(str, enum.Enum):
    available = "available"
    in_use = "in_use"
    frozen = "frozen"

class FreezeReason(str, enum.Enum):
    accident = "accident"
    maintenance = "maintenance"
    personal = "personal"

class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    plate_number = Column(Text, nullable=False, unique=True)
    type = Column(Text, nullable=False, index=True)
    fuel_type = Column(Enum(FuelType), nullable=False)
    status = Column(Enum(VehicleStatus), nullable=False, default=VehicleStatus.available, index=True)
    freeze_reason = Column(Enum(FreezeReason), nullable=True)
    freeze_details = Column(Text, nullable=True) 
    last_used_at = Column(DateTime, nullable=True)
    current_location = Column(Text, nullable=False)
    odometer_reading = Column(Integer, nullable=False, default=0)
    vehicle_model = Column(Text, nullable=False)
    image_url = Column(Text, nullable=False)
    lease_expiry = Column(DateTime, nullable=True)
    department_id = Column(UUID(as_uuid=True), nullable=True)
    is_archived = Column(Boolean, default=False, nullable=False)
    archived_at = Column(DateTime, nullable=True)


   