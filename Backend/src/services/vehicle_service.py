from sqlalchemy.orm import Session
from sqlalchemy.types import String  # To cast to string
from typing import Optional, List , Dict , Union
from ..models.vehicle_model import Vehicle, VehicleType, VehicleStatus
from sqlalchemy import func, cast 
from sqlalchemy import and_
from ..models.ride_model import Ride, RideStatus
from ..models.user_model import User
from datetime import datetime
from ..schemas.vehicle_schema import VehicleOut, InUseVehicleOut
from uuid import UUID
from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError

# def get_available_vehicles(db: Session, type: Optional[VehicleType] = None) -> List[Vehicle]:
#     query = db.query(Vehicle).filter(Vehicle.status == VehicleStatus.available)

#     if type:
#         # Convert both the database value and the input to lowercase and trim any spaces
#         query = query.filter(
#             func.trim(func.lower(cast(Vehicle.type, String))) == type.lower()
#         )

#     return query.all()

# # def get_in_use_vehicles(db: Session, type: Optional[VehicleType] = None) -> List[Vehicle]:
# #     query = db.query(Vehicle).filter(Vehicle.status == VehicleStatus.in_use)

# #     if type:
# #         query = query.filter(
# #             func.trim(func.lower(cast(Vehicle.type, String))) == type.lower()
# #         )

# #     return query.all()

# def get_frozen_vehicles(db: Session, type: Optional[VehicleType] = None) -> List[Vehicle]:
#     query = db.query(Vehicle).filter(Vehicle.status == VehicleStatus.frozen)

#     if type:
#         query = query.filter(
#             func.trim(func.lower(cast(Vehicle.type, String))) == type.lower()
#         )

#     return query.all()

# def get_in_use_vehicles(db: Session):
#     result = (
#         db.query(
#             Vehicle.id,
#             Vehicle.plate_number,
#             Vehicle.type,
#             Vehicle.fuel_type,
#             Vehicle.status,
#             Vehicle.odometer_reading,
#             User.employee_id.label("user_id"),
#             User.first_name,
#             User.last_name,
#             Ride.start_datetime,
#             Ride.end_datetime
#         )
#         .join(Ride, Vehicle.id == Ride.vehicle_id)
#         .join(User, Ride.user_id == User.employee_id)
#         .filter(Vehicle.status == "in_use")
#         .all()
#     )

#     # הופך את הרשומות לדיקטים
#     return [dict(r._mapping) for r in result]


def get_vehicles_with_optional_status(
    db: Session, status: Optional[VehicleStatus] = None
) -> List[Union[VehicleOut, InUseVehicleOut]]:
    query = (
        db.query(
            Vehicle.id,
            Vehicle.plate_number,
            Vehicle.type,
            Vehicle.fuel_type,
            Vehicle.status,
            Vehicle.freeze_reason,
            Vehicle.last_used_at,
            Vehicle.current_location,
            Vehicle.odometer_reading,
            Vehicle.vehicle_model,
            Vehicle.image_url,
            User.employee_id.label("user_id"),
            User.first_name,
            User.last_name,
            Ride.start_datetime,
            Ride.end_datetime,
        )
        .outerjoin(
            Ride,
            and_(
                Ride.vehicle_id == Vehicle.id,
                Ride.status == "approved",
                Ride.start_datetime <= datetime.now(),     
                Ride.end_datetime >= datetime.now()      
            ) 
        )    
        .outerjoin(User, User.employee_id == Ride.user_id)
    )

    if status:
        query = query.filter(Vehicle.status == status)

    vehicles = query.all()

    result = []
    for row in vehicles:
        data = dict(row._mapping)
        if data["status"] == VehicleStatus.in_use:
            result.append(InUseVehicleOut(**data))
        else:
            result.append(VehicleOut(**data))

    print("Result:", result)


    return result

def update_vehicle_status(vehicle_id: UUID, new_status: VehicleStatus, freeze_reason: str, db: Session):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    try:
        if new_status == VehicleStatus.frozen:
            if not freeze_reason:
                raise HTTPException(status_code=400, detail="freeze_reason is required when setting status to 'frozen'")
            vehicle.freeze_reason = freeze_reason

        elif vehicle.status == VehicleStatus.frozen and new_status != VehicleStatus.frozen:
            vehicle.freeze_reason = None

        vehicle.status = new_status
        db.commit()
        db.refresh(vehicle)
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return {"vehicle_id": vehicle.id, "new_status": vehicle.status, "freeze_reason": vehicle.freeze_reason}


def get_available_vehicles(
    db: Session
) -> List[VehicleOut]:
    query = (
        db.query(
            Vehicle.id,
            Vehicle.plate_number,
            Vehicle.type,
            Vehicle.fuel_type,
            Vehicle.status,
            Vehicle.freeze_reason,
            Vehicle.last_used_at,
            Vehicle.current_location,
            Vehicle.odometer_reading,
            Vehicle.vehicle_model,
            Vehicle.image_url,
        )
        .filter(Vehicle.status == VehicleStatus.available)
    )

    vehicles = query.all()
    result = []
    for row in vehicles:
        data = dict(row._mapping)
        result.append(VehicleOut(**data))
    return result