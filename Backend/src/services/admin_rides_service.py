from typing import List, Optional , Dict
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import String, extract, func
from uuid import UUID

from ..models.ride_model import Ride, RideStatus
from ..models.vehicle_model import Vehicle
from ..models.user_model import User  
from ..schemas.ride_dashboard_item import RideDashboardItem
import calendar
from ..models.monthly_vehicle_usage_model import MonthlyVehicleUsage

def filter_rides(query, status: Optional[RideStatus], from_date, to_date):
    if status:
        query = query.filter(Ride.status == status)
    if from_date:
        query = query.filter(Ride.start_datetime >= from_date)
    if to_date:
        query = query.filter(Ride.start_datetime <= to_date)
    return query.order_by(Ride.start_datetime)

def build_dashboard_item(
    ride_id, user_first_name, user_last_name, vehicle_id,
    start_datetime, estimated_distance_km, status
):
    return RideDashboardItem(
        ride_id=ride_id,
        employee_name=f"{user_first_name} {user_last_name}",
        requested_vehicle_plate=f"Plate-{vehicle_id[:8]}",
        date_and_time=start_datetime,
        distance=str(estimated_distance_km),
        status=status
    )

def get_all_orders(db: Session, status=None, from_date=None, to_date=None) -> List[RideDashboardItem]:
    query = db.query(
        Ride.id.label("ride_id"),
        Ride.start_datetime,
        Ride.estimated_distance_km,
        Ride.status,
        Vehicle.id.label("vehicle_id"),
        User.first_name,
        User.last_name
    ).join(Vehicle, Ride.vehicle_id == Vehicle.id) \
     .join(User, Ride.user_id == User.employee_id)  

    query = filter_rides(query, status, from_date, to_date)

    return [
        build_dashboard_item(
            ride_id=r.ride_id,
            user_first_name=r.first_name,
            user_last_name=r.last_name,
            vehicle_id=r.vehicle_id,
            start_datetime=r.start_datetime,
            estimated_distance_km=r.estimated_distance_km,
            status=r.status
        )
        for r in query.all()
    ]

def get_future_orders(db: Session, status=None, from_date=None, to_date=None) -> List[RideDashboardItem]:
    filter_from_date = from_date or datetime.utcnow()
    return get_all_orders(db, status=status, from_date=filter_from_date, to_date=to_date)

def get_past_orders(db: Session, status=None, from_date=None, to_date=None) -> List[RideDashboardItem]:
    filter_to_date = to_date or datetime.utcnow()
    return get_all_orders(db, status=status, from_date=from_date, to_date=filter_to_date)

def get_orders_by_user(db: Session, user_id: UUID) -> List[RideDashboardItem]:
    query = db.query(
        Ride.id.label("ride_id"),
        Ride.start_datetime,
        Ride.estimated_distance_km,
        Ride.status,
        Vehicle.id.label("vehicle_id"),
        User.first_name,
        User.last_name
    ).join(Vehicle, Ride.vehicle_id == Vehicle.id) \
     .join(User, Ride.user_id == User.employee_id) \
     .filter(User.employee_id == user_id)

    return [
        build_dashboard_item(
            ride_id=r.ride_id,
            user_first_name=r.first_name,
            user_last_name=r.last_name,
            vehicle_id=r.vehicle_id,
            start_datetime=r.start_datetime,
            estimated_distance_km=r.estimated_distance_km,
            status=r.status
        )
        for r in query.all()
    ]

def get_order_by_ride_id(db: Session, ride_id: UUID) -> Optional[RideDashboardItem]:
    r = db.query(
        Ride.id.label("ride_id"),
        Ride.start_datetime,
        Ride.estimated_distance_km,
        Ride.status,
        Vehicle.id.label("vehicle_id"),
        User.first_name,
        User.last_name
    ).join(Vehicle, Ride.vehicle_id == Vehicle.id) \
     .join(User, Ride.user_id == User.employee_id) \
     .filter(Ride.id == ride_id) \
     .first()

    if not r:
        return None

    return build_dashboard_item(
        ride_id=r.ride_id,
        user_first_name=r.first_name,
        user_last_name=r.last_name,
        vehicle_id=r.vehicle_id,
        start_datetime=r.start_datetime,
        estimated_distance_km=r.estimated_distance_km,
        status=r.status
    )


def update_monthly_usage_stats(db: Session, ride: Ride):

    if not ride.end_datetime:
        ride.end_datetime = datetime.utcnow()

    year = ride.start_datetime.year
    month = ride.start_datetime.month
    duration_hours = (ride.end_datetime - ride.start_datetime).total_seconds() / 3600.0
    distance = float(ride.actual_distance_km or 0)

    stats = db.query(MonthlyVehicleUsage).filter_by(
        vehicle_id=ride.vehicle_id,
        year=year,
        month=month
    ).first()

    if stats:
        stats.total_rides += 1
        stats.total_km += distance
        stats.usage_hours += duration_hours
    else:
        stats = MonthlyVehicleUsage(
            vehicle_id=ride.vehicle_id,
            year=year,
            month=month,
            total_rides=1,
            total_km=distance,
            usage_hours=duration_hours
        )
        db.add(stats)


def get_current_month_vehicle_usage(db: Session) -> List[Dict]:
    now = datetime.utcnow()
    current_year = now.year
    current_month = now.month

    usage_entries = db.query(MonthlyVehicleUsage).filter_by(
        year=current_year,
        month=current_month
    ).all()

    return [
        {
            "vehicle_id": str(entry.vehicle_id),
            "year": entry.year,
            "month": entry.month,
            "total_rides": entry.total_rides,
            "total_km": entry.total_km,
            "usage_hours": entry.usage_hours
        }
        for entry in usage_entries
    ]