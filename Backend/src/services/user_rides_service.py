from sqlalchemy.orm import Session
from typing import List, Optional
from ..models.ride_model import Ride , RideStatus
from ..schemas.user_rides_schema import RideSchema
from uuid import UUID
from ..models.vehicle_model import Vehicle
from sqlalchemy import String, text
from datetime import datetime, timezone
from fastapi import HTTPException
from src.schemas.ride_status_enum import RideStatusEnum
from datetime import timedelta
from ..utils.audit_utils import log_action

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
    # Use naive datetime for Postgres 'timestamp without time zone'
    mynow = datetime.utcnow().replace(tzinfo=None)

    query = db.query(
        Ride.id.label("ride_id"),
        Ride.ride_type,
        Ride.start_location,
        Ride.stop,
        Ride.destination,
        Ride.start_datetime,
        Ride.end_datetime,
        Ride.estimated_distance_km.cast(String).label("estimated_distance"),
        Ride.status,
        Ride.submitted_at,
        Ride.user_id,
        Vehicle.fuel_type.label("vehicle")
    ).join(Vehicle, Ride.vehicle_id == Vehicle.id).filter(
        Ride.user_id == user_id,
        Ride.start_datetime > mynow,
        Ride.is_archive == False 
    )

    # Apply additional filters if necessary
    query = filter_rides(query, status, from_date, to_date)

    rows = query.all()
    return [RideSchema(**dict(row._mapping)) for row in rows]

# def get_past_rides(user_id: UUID, db: Session, status=None, from_date=None, to_date=None) -> List[Ride]:
#     query = db.query(Ride).filter(Ride.user_id == user_id, Ride.start_datetime <= datetime.utcnow())
#     return filter_rides(query, status, from_date, to_date).all()

def get_past_rides(user_id: UUID, db: Session, status=None, from_date=None, to_date=None) -> List[RideSchema]:
    now = datetime.utcnow().replace(tzinfo=None)
 # naive datetime for naive DB

    query = db.query(
        Ride.id.label("ride_id"),
        Ride.ride_type,
        Ride.start_location,
        Ride.stop,
        Ride.destination,
        Ride.start_datetime,
        Ride.end_datetime,
        Ride.estimated_distance_km.cast(String).label("estimated_distance"),
        Ride.status,
        Ride.submitted_at,
        Ride.user_id,
        Vehicle.fuel_type.label("vehicle")
    ).join(Vehicle, Ride.vehicle_id == Vehicle.id).filter(Ride.user_id == user_id, Ride.start_datetime <= now)

    query = filter_rides(query, status, from_date, to_date)
    rows = query.all() 
    return [RideSchema(**dict(row._mapping)) for row in rows] 


# def get_all_rides(user_id: UUID, db: Session, status=None, from_date=None, to_date=None) -> List[Ride]:
#     query = db.query(Ride).filter(Ride.user_id == user_id)
#     return filter_rides(query, status, from_date, to_date).all()

def get_all_rides(user_id: UUID, db: Session, status=None, from_date=None, to_date=None) -> List[RideSchema]:
    query = db.query(
       Ride.id.label("ride_id"),
       Ride.ride_type,
       Ride.start_location,
       Ride.stop,
       Ride.destination,
       Ride.start_datetime,
       Ride.end_datetime,
       Ride.estimated_distance_km.cast(String).label("estimated_distance"),
       Ride.status,
       Ride.submitted_at,
       Ride.user_id,
       Vehicle.fuel_type.label("vehicle")
    ).join(Vehicle, Ride.vehicle_id == Vehicle.id).filter(Ride.user_id == user_id)

    query = filter_rides(query, status, from_date, to_date)

    rows = query.all() 

    return [RideSchema(**dict(row._mapping)) for row in rows]  #convert rows to Pydantic objects

    
def update_ride_status(db: Session, ride_id: UUID, new_status: str, changed_by: UUID):
    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(changed_by)})
    # Fetch the ride
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride:
        raise ValueError("Ride not found")

    # Update the ride status
    ride.status = new_status
    db.commit()
    db.refresh(ride)

    # print(f"\n !!!!!!!!!!!!!!!!!!!!!!!! changed_by: {changed_by} !!!!!!!!!!!!!!!!!!!!!!!!!!!\n")

    # Log the audit entry with all ride details and the new status
    # log_action(
    #     db=db,
    #     action="UPDATE",  # Correct action
    #     entity_type="Ride",
    #     entity_id=str(ride.id),
    #     change_data={
    #         "id": str(ride.id),
    #         "stop": ride.stop,
    #         "status": ride.status,  # Include the new status
    #         "user_id": str(ride.user_id),
    #         "isArchive": ride.isArchive,
    #         "ride_type": ride.ride_type,
    #         "vehicle_id": str(ride.vehicle_id),
    #         "destination": ride.destination,
    #         "end_datetime": ride.end_datetime.isoformat(),
    #         "submitted_at": ride.submitted_at.isoformat(),
    #         "start_datetime": ride.start_datetime.isoformat(),
    #         "start_location": ride.start_location,
    #         "emergency_event": ride.emergency_event,
    #         "override_user_id": str(ride.override_user_id),
    #         "actual_distance_km": ride.actual_distance_km,
    #         "license_check_passed": ride.license_check_passed,
    #         "estimated_distance_km": ride.estimated_distance_km
    #     },
    #     changed_by=changed_by,
    # )
    db.execute(text("SET session.audit.user_id = DEFAULT"))


    return ride



# def get_ride_by_id(db: Session, ride_id: UUID) -> Ride:
#     ride = db.query(Ride).filter(Ride.id == ride_id).first()
#     if not ride:
#         raise HTTPException(status_code=404, detail="Ride not found")
#     db.refresh(ride)  
#     return ride


def get_ride_by_id(db: Session, ride_id: UUID) -> RideSchema:
    ride = db.query(
        Ride.id.label("ride_id"),
        Ride.ride_type,
        Ride.start_location,
        Ride.stop,
        Ride.destination,
        Ride.start_datetime,
        Ride.end_datetime,
        Ride.estimated_distance_km.cast(String).label("estimated_distance"),
        Ride.status,
        Ride.submitted_at,
        Ride.user_id,
        Vehicle.fuel_type.label("vehicle")
    ).join(Vehicle, Ride.vehicle_id == Vehicle.id).filter(Ride.id == ride_id).first()

    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    return RideSchema(**dict(ride._mapping))

def get_archived_rides(user_id: UUID, db: Session) -> List[RideSchema]:
    # Get current datetime and subtract 2 months
    cutoff_date = datetime.utcnow().replace(tzinfo=None) - timedelta(days=60)
    query = db.query(
        Ride.id.label("ride_id"),
        Ride.ride_type,
        Ride.start_location,
        Ride.stop,
        Ride.destination,
        Ride.start_datetime,
        Ride.end_datetime,
        Ride.estimated_distance_km.cast(String).label("estimated_distance"),
        Ride.status,
        Ride.submitted_at,
        Ride.user_id,
        Vehicle.fuel_type.label("vehicle")
    ).join(Vehicle, Ride.vehicle_id == Vehicle.id).filter(
        Ride.user_id == user_id,
        Ride.start_datetime < cutoff_date,
        Ride.is_archive.is_(True)

    ).order_by(Ride.start_datetime)

    rows = query.all()
    return [RideSchema(**dict(row._mapping)) for row in rows]



def cancel_order_in_db(order_id: UUID, db: Session):
    order = db.query(Ride).filter(Ride.id == order_id).first()

    if not order:
        raise HTTPException(status_code=404, detail="ההזמנה לא נמצאה")

    if order.status == "cancelled":
        raise HTTPException(status_code=400, detail="ההזמנה כבר בוטלה")

    order.status = "cancelled"
    db.commit()
    db.refresh(order)
    return order


