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
            completed_trip_count=1,
            last_updated=datetime.utcnow()
        )
        db.add(stat)

def archive_last_month_stats(db: Session):
    today = date.today()
    first_day_of_current_month = date(today.year, today.month, 1)

    db.query(MonthlyEmployeeTripStats).filter(
        MonthlyEmployeeTripStats.month_year < first_day_of_current_month,
        MonthlyEmployeeTripStats.is_archived == False
    ).update(
        {MonthlyEmployeeTripStats.is_archived: True},
        synchronize_session=False
    )

    db.commit()


