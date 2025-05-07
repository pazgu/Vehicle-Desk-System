from sqlalchemy.orm import Session
from models.new_ride_model import Ride
from schemas.new_ride_schema import RideCreate

def add_ride_service(ride_data: RideCreate, db: Session):
    new_ride = Ride(
        start_datetime= ride_data.start_datetime,
        end_datetime= ride_data.end_datetime,
        destination= ride_data.destination,
    )
    db.add(new_ride)
    db.commit()
    db.refresh(new_ride)
    return new_ride

