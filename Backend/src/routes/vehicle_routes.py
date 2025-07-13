from src.models.department_model import Department
from datetime import datetime, date, time

from sqlalchemy import text
from ..services.vehicle_service import get_vehicles_with_optional_status,update_vehicle_status,get_vehicle_by_id, get_available_vehicles_for_ride_by_id
from fastapi import APIRouter, Depends, HTTPException, status , Query
from uuid import UUID
from ..schemas.vehicle_schema import VehicleStatusUpdate, RideTimelineSchema
from ..utils.socket_manager import sio
from sqlalchemy.orm import Session
from ..schemas.vehicle_schema import VehicleOut
from ..schemas.check_vehicle_schema import VehicleInspectionSchema
from ..utils.auth import token_check
from ..utils.database import get_db
from typing import List, Optional, Union
from src.schemas.vehicle_create_schema import VehicleCreate
from src.models.vehicle_model import VehicleStatus, Vehicle
from src.models.ride_model import Ride
from src.models.user_model import User

router = APIRouter()

# @router.post("/vehicle-inspection")
# def vehicle_inspection(data: VehicleInspectionSchema, db: Session = Depends(get_db),payload: dict = Depends(token_check)):
#     try:
#         return vehicle_inspection_logic(data, db)
#     except HTTPException as e:
#         raise e
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))
    

@router.get("/all-vehicles", response_model=List[VehicleOut])
def get_all_vehicles_route(status: Optional[str] = Query(None), db: Session = Depends(get_db), payload: dict = Depends(token_check)):
    vehicles = get_vehicles_with_optional_status(db, status)
    return vehicles

@router.get("/vehicles/{vehicle_id}/fuel-type")
def get_vehicle_fuel_type(vehicle_id: UUID, db: Session = Depends(get_db)):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"vehicle_id": str(vehicle.id), "fuel_type": vehicle.fuel_type}


@router.patch("/{vehicle_id}/status")
def patch_vehicle_status(
    vehicle_id: UUID,
    status_update: VehicleStatusUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(token_check)
):
    user_id = payload.get("user_id") or payload.get("sub")
    if not user_id:
        return {"error": "User ID not found in token"}, 401
    
    res=update_vehicle_status(vehicle_id, status_update.new_status, status_update.freeze_reason, db, user_id)
    new_status=res["new_status"]
    sio.emit('vehicle_status_updated', {
            "vehicle_id": str(vehicle_id),
            "status": new_status,
            "freeze_reason": res.get("freeze_reason", "")
    })
    return res




@router.get("/{ride_id}/available-vehicles", response_model=List[VehicleOut])
def available_vehicles_for_ride(
    ride_id: UUID,
    db: Session = Depends(get_db)
):
    try:
        return get_available_vehicles_for_ride_by_id(db, ride_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.get("/vehicle/{vehicle_id}")
def get_vehicle_by_id_route(vehicle_id: str, db: Session = Depends(get_db)):
    return get_vehicle_by_id(vehicle_id, db)




@router.post("/add-vehicle", response_model=VehicleOut, status_code=status.HTTP_201_CREATED)
def create_vehicle(
    vehicle_data: VehicleCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(token_check)  # <-- get user info from token
):
    user_id = payload.get("user_id") or payload.get("sub") or "system"
    db.execute(text("SET LOCAL session.audit.user_id = :user_id"), {"user_id": user_id})
    
    existing_vehicle = db.query(Vehicle).filter_by(plate_number=vehicle_data.plate_number).first()
    if existing_vehicle:
        raise HTTPException(status_code=400, detail="Vehicle with this plate number already exists")
    
    # Validate department if provided
    if vehicle_data.department_id:
        department = db.query(Department).filter_by(id=vehicle_data.department_id).first()
        if not department:
            raise HTTPException(status_code=404, detail="Department not found")

    data = vehicle_data.dict()
    data['image_url'] = str(data['image_url']) if data.get('image_url') else None
    data.setdefault('status', VehicleStatus.available)

    new_vehicle = Vehicle(**data)
    db.add(new_vehicle)
    db.commit()
    db.refresh(new_vehicle)
    return new_vehicle


@router.get("/vehicles/types")
def get_vehicle_types(
    db: Session = Depends(get_db),
    payload: dict = Depends(token_check)
):
    try:
        vehicle_types = db.query(Vehicle.type).distinct().all()
        return {"vehicle_types": [vt[0] for vt in vehicle_types]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
@router.get("/vehicles/{vehicle_id}/timeline", response_model=List[RideTimelineSchema])
def get_vehicle_timeline(
    vehicle_id: UUID,
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    db: Session = Depends(get_db),
):
    
    start_dt = datetime.combine(from_date, time.min)  # 00:00:00 on from_date
    end_dt = datetime.combine(to_date, time.max)      # 23:59:59.999999 on to_date

    rides = db.query(
        Ride.vehicle_id,
        Ride.start_datetime,
        Ride.end_datetime,
        Ride.status,
        Ride.user_id,
        User.first_name,
        User.last_name,
    ).join(User, Ride.user_id == User.employee_id).filter(
        Ride.vehicle_id == vehicle_id,
        Ride.start_datetime >= start_dt,
        Ride.end_datetime <= end_dt
    ).all()

    return [RideTimelineSchema(**dict(row._mapping)) for row in rides]