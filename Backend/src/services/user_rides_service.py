from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from ..models.ride_model import Ride , RideStatus
from ..schemas.user_rides_schema import RideSchema
from uuid import UUID
from ..models.vehicle_model import Vehicle
from sqlalchemy import String
from fastapi import HTTPException
from src.schemas.ride_status_enum import RideStatusEnum

def filter_rides(query, status: Optional[RideStatus], from_date, to_date):
    if status:
        query = query.filter(Ride.status == status)
    if from_date:
        query = query.filter(Ride.start_datetime >= from_date)
    if to_date:
        query = query.filter(Ride.start_datetime <= to_date)
    return query.order_by(Ride.start_datetime)

# def get_future_rides(user_id: UUID, db: Session, status=None, from_date=None, to_date=None) -> List[Ride]:
#     query = db.query(Ride).filter(Ride.user_id == user_id, Ride.start_datetime > datetime.utcnow())
#     return filter_rides(query, status, from_date, to_date).all()


def get_future_rides(user_id: UUID, db: Session, status=None, from_date=None, to_date=None) -> List[RideSchema]:
    # Updated query with join and casting
    now = datetime.now()  # naive datetime for naive DB

    query = db.query(
        Ride.id.label("ride_id"),
        Vehicle.fuel_type.label("vehicle"),
        Ride.start_datetime,
        Ride.end_datetime,
        Ride.estimated_distance_km.cast(String).label("estimated_distance"),  # Casting to string
        Ride.status
    ).join(Vehicle, Ride.vehicle_id == Vehicle.id).filter(Ride.user_id == user_id, Ride.start_datetime > now)

    # Apply additional filters if necessary
    query = filter_rides(query, status, from_date, to_date)

    # Fetch and return the result as a list of RideSchema
    return query.all()



# def get_past_rides(user_id: UUID, db: Session, status=None, from_date=None, to_date=None) -> List[Ride]:
#     query = db.query(Ride).filter(Ride.user_id == user_id, Ride.start_datetime <= datetime.utcnow())
#     return filter_rides(query, status, from_date, to_date).all()

def get_past_rides(user_id: UUID, db: Session, status=None, from_date=None, to_date=None) -> List[RideSchema]:
    now = datetime.now()  # naive datetime for naive DB

    query = db.query(
        Ride.id.label("ride_id"),
        Vehicle.fuel_type.label("vehicle"),
        Ride.start_datetime,
        Ride.end_datetime,
        Ride.estimated_distance_km.cast(String).label("estimated_distance"),  # Casting to string
        Ride.status
    ).join(Vehicle, Ride.vehicle_id == Vehicle.id).filter(Ride.user_id == user_id, Ride.start_datetime <= now)

    query = filter_rides(query, status, from_date, to_date)
    return query.all()


# def get_all_rides(user_id: UUID, db: Session, status=None, from_date=None, to_date=None) -> List[Ride]:
#     query = db.query(Ride).filter(Ride.user_id == user_id)
#     return filter_rides(query, status, from_date, to_date).all()

def get_all_rides(user_id: UUID, db: Session, status=None, from_date=None, to_date=None) -> List[RideSchema]:
    query = db.query(
        Ride.id.label("ride_id"),
        Vehicle.fuel_type.label("vehicle"),
        Ride.start_datetime,
        Ride.end_datetime,
        Ride.estimated_distance_km.cast(String).label("estimated_distance"),  # Casting to string
        Ride.status
    ).join(Vehicle, Ride.vehicle_id == Vehicle.id).filter(Ride.user_id == user_id)

    query = filter_rides(query, status, from_date, to_date)
    return query.all()
    
def update_ride_status(ride_id: UUID, new_status: RideStatusEnum, db: Session):
    ride = db.query(Ride).filter(Ride.id == ride_id).first()

    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    if ride.status in [RideStatus.cancelled, RideStatus.completed]:
        raise HTTPException(status_code=400, detail="Cannot change status of a completed or cancelled ride")

    ride.status = RideStatus(new_status.value)  
    db.commit()
    db.refresh(ride)
    return {"ride_id": ride.id, "new_status": ride.status}