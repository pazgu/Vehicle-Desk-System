from sqlalchemy import extract, func
from sqlalchemy.orm import Session
from datetime import datetime, date
from ..models.ride_model import Ride
from ..models.monthly_employee_trip_stats_model import MonthlyEmployeeTripStats
from src.models.user_model import User 
from collections import defaultdict

def update_monthly_trip_counts(db: Session):
    results = db.query(
        Ride.user_id.label("employee_id"),
        extract('year', Ride.start_datetime).label('year'),
        extract('month', Ride.start_datetime).label('month'),
        Ride.status,
        func.count().label('trip_count')
    ).filter(
        Ride.status.in_(['approved', 'completed']),
        Ride.is_archive == False
    ).group_by(
        Ride.user_id,
        'year',
        'month',
        Ride.status
    ).all()

    stats = defaultdict(lambda: {'approved': 0, 'completed': 0})

    for row in results:
        key = (row.employee_id, int(row.year), int(row.month))
        stats[key][row.status] = row.trip_count

    for (employee_id, year, month), counts in stats.items():
        user_exists = db.query(User).filter(User.employee_id == employee_id).first()
        if not user_exists:
            print(f"User {employee_id} not found in users table. Skipping.")
            continue

        month_year_date = date(year, month, 1) 

        stat = db.query(MonthlyEmployeeTripStats).filter_by(
            employee_id=employee_id,
            month_year=month_year_date
        ).first()

        if stat:
            stat.approved_trip_count = counts['approved']
            stat.completed_trip_count = counts['completed']
            stat.last_updated = datetime.utcnow()
        else:
            stat = MonthlyEmployeeTripStats(
                employee_id=employee_id,
                month_year=month_year_date,
                approved_trip_count=counts['approved'],
                completed_trip_count=counts['completed'],
                last_updated=datetime.utcnow()
            )
            db.add(stat)

    db.commit()



