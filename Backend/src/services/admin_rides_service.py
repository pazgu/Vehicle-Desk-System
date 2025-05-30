from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import String
from uuid import UUID

from ..models.ride_model import Ride, RideStatus
from ..models.vehicle_model import Vehicle
from ..models.user_model import User  
from ..schemas.ride_dashboard_item import RideDashboardItem

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
