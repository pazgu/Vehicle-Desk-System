import uuid
from datetime import datetime, date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Column, Date, Integer, ForeignKey, TIMESTAMP, Boolean
import uuid
from src.models.base import Base


class MonthlyEmployeeTripStats(Base):
    __tablename__ = "monthly_employee_trip_stats"

    employee_id = Column(UUID(as_uuid=True), ForeignKey("users.employee_id"), primary_key=True)
    month_year = Column(Date, primary_key=True)  
    completed_trip_count = Column(Integer, nullable=False, default=0)
    last_updated = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)
    is_archived = Column(Boolean, nullable=False, default=False)


