from sqlalchemy.orm import Session
from uuid import uuid4, UUID
from ..schemas.new_ride_schema import RideCreate
from ..models.ride_model import Ride,RideStatus
from datetime import datetime
def create_ride(db: Session, user_id: UUID, ride: RideCreate):
    new_ride = Ride(
        id=uuid4(),
        user_id=user_id,
        vehicle_id='0ecbc987-5c70-4b06-b11e-483a8e363279',
        ride_type=ride.ride_type,
        start_datetime=ride.start_datetime,
        end_datetime=ride.end_datetime,
        start_location=ride.start_location,
        stop=ride.stop,
        destination=ride.destination,
        estimated_distance_km=ride.estimated_distance_km,
        status=RideStatus.pending,  
        license_check_passed=False,  
        submitted_at=datetime.utcnow(),  
    )
    db.add(new_ride)
    db.commit()
    db.refresh(new_ride)
    return new_ride

    
