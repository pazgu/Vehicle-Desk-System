from sqlalchemy import Column, Integer, Float, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from src.models.base import Base

class MonthlyVehicleUsage(Base):
    __tablename__ = 'monthly_vehicle_usage'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)

    total_rides = Column(Integer, default=0)
    total_km = Column(Float, default=0)
    usage_hours = Column(Float, default=0)

    __table_args__ = (
        UniqueConstraint('vehicle_id', 'year', 'month', name='unique_monthly_usage'),
    )

    vehicle = relationship("Vehicle", backref="monthly_usages")