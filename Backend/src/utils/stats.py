from datetime import datetime
from sqlalchemy import extract, func
from sqlalchemy.orm import Session
from uuid import uuid4

from src.models.ride_model import Ride
from src.models.monthly_vehicle_usage_model import MonthlyVehicleUsage  # Adjust path if needed

def generate_monthly_vehicle_usage(db: Session, year: int, month: int):
    # Query all approved rides grouped by vehicle for that month/year
    results = (
        db.query(
            Ride.vehicle_id,
            func.count(Ride.id).label("total_rides"),
            func.sum(Ride.actual_distance_km).label("total_km"),
            func.sum(
                func.extract('epoch', Ride.end_datetime - Ride.start_datetime)
            ).label("usage_seconds")
        )
        .filter(
            Ride.status == 'approved',
            extract('year', Ride.start_datetime) == year,
            extract('month', Ride.start_datetime) == month
        )
        .group_by(Ride.vehicle_id)
        .all()
    )

    for row in results:
        usage_hours = round((row.usage_seconds or 0) / 3600, 2)

        existing = db.query(MonthlyVehicleUsage).filter_by(
            vehicle_id=row.vehicle_id,
            year=year,
            month=month
        ).first()

        if existing:
            existing.total_rides = row.total_rides
            existing.total_km = row.total_km or 0
            existing.usage_hours = usage_hours
        else:
            new_record = MonthlyVehicleUsage(
                id=uuid4(),
                vehicle_id=row.vehicle_id,
                year=year,
                month=month,
                total_rides=row.total_rides,
                total_km=row.total_km or 0,
                usage_hours=usage_hours
            )
            db.add(new_record)

    db.commit()
