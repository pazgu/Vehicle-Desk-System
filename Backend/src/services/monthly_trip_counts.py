from sqlalchemy import extract, func
from sqlalchemy.orm import Session
from datetime import datetime, date
from ..models.ride_model import Ride
from ..models.monthly_employee_trip_stats_model import MonthlyEmployeeTripStats
from src.models.user_model import User 
from collections import defaultdict

def increment_completed_trip_stat(db: Session, user_id: int, ride_start_datetime: datetime):
    year = ride_start_datetime.year
    month = ride_start_datetime.month
    month_year_date = date(year, month, 1)

    stat = db.query(MonthlyEmployeeTripStats).filter_by(
        employee_id=user_id,
        month_year=month_year_date
    ).first()

    if stat:
        stat.completed_trip_count += 1
        stat.last_updated = datetime.utcnow()
    else:
        stat = MonthlyEmployeeTripStats(
            employee_id=user_id,
            month_year=month_year_date,
            approved_trip_count=0,
            completed_trip_count=1,
            last_updated=datetime.utcnow()
        )
        db.add(stat)




