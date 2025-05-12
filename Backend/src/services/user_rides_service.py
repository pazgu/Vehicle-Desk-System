from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from ..models.ride_model import Ride , RideStatus
from ..schemas.user_rides_schema import RideSchema

def filter_rides(query, status: Optional[RideStatus], from_date, to_date):
    if status:
        query = query.filter(Ride.status == status)
    if from_date:
        query = query.filter(Ride.start_datetime >= from_date)
    if to_date:
        query = query.filter(Ride.start_datetime <= to_date)
    return query.order_by(Ride.start_datetime)

def get_future_rides(user_id: int, db: Session, status=None, from_date=None, to_date=None) -> List[Ride]:
    query = db.query(Ride).filter(Ride.user_id == user_id, Ride.start_datetime > datetime.utcnow())
    return filter_rides(query, status, from_date, to_date).all()

def get_past_rides(user_id: int, db: Session, status=None, from_date=None, to_date=None) -> List[Ride]:
    query = db.query(Ride).filter(Ride.user_id == user_id, Ride.start_datetime <= datetime.utcnow())
    return filter_rides(query, status, from_date, to_date).all()

def get_all_rides(user_id: int, db: Session, status=None, from_date=None, to_date=None) -> List[Ride]:
    query = db.query(Ride).filter(Ride.user_id == user_id)
    return filter_rides(query, status, from_date, to_date).all()
