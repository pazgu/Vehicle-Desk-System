from sqlalchemy.orm import Session
from sqlalchemy.types import String  # To cast to string
from typing import Optional, List
from ..models.vehicle_model import Vehicle, VehicleType, VehicleStatus
from sqlalchemy import func, cast


def get_available_vehicles(db: Session, type: Optional[VehicleType] = None) -> List[Vehicle]:
    query = db.query(Vehicle).filter(Vehicle.status == VehicleStatus.available)

    if type:
        # Convert both the database value and the input to lowercase and trim any spaces
        query = query.filter(
            func.trim(func.lower(cast(Vehicle.type, String))) == type.lower()
        )

    return query.all()