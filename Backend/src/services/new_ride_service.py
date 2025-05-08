from typing import List
from ..schemas.new_ride_schema import RideCreate
import uuid
from datetime import datetime

mock_rides: List[dict] = []

def create_ride(user_id: uuid.UUID, ride: RideCreate):

    ride_id = uuid.uuid4()

    new_ride = ride.dict()
    new_ride['id'] = ride_id
    new_ride['user_id'] = user_id  
    

    mock_rides.append(new_ride)
    
    return new_ride
