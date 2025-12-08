from datetime import date, time, datetime, timedelta, timezone
from typing import List, Optional, Union
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import text, func, or_
from sqlalchemy.orm import Session

from ..helpers.department_helpers import get_or_create_vip_department

from ..helpers.user_helpers import cancel_future_rides_for_vehicle

# Utils
from ..utils.auth import token_check, get_current_user, role_check
from ..utils.database import get_db
from ..utils.socket_manager import sio

# Services
from ..services.vehicle_service import (
    get_vehicle_km_driven_on_date,
    get_vehicles_with_optional_status,
    get_available_vehicles_new_ride,
    update_vehicle_status,
    get_vehicle_by_id, update_vehicle,
    get_available_vehicles_for_ride_by_id,
    get_inactive_vehicles, get_most_used_vehicles_all_time
)

# Schemas
from ..schemas.check_vehicle_schema import VehicleInspectionSchema
from ..schemas.vehicle_schema import VehicleOut, VehicleStatusUpdate, RideTimelineSchema , VehicleUpdateRequest
from src.schemas.vehicle_create_schema import VehicleCreate

# Models
from src.models.department_model import Department
from src.models.ride_model import Ride
from src.models.user_model import User
from src.models.vehicle_model import VehicleStatus, Vehicle

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

router = APIRouter()

@router.get("/all-vehicles-new-ride", response_model=List[VehicleOut])
def get_all_vehicles_route(
    distance_km: float = Query(...),
    ride_date: Optional[date] = Query(None),
    type: Optional[str] = Query(None), 
    start_time:Optional[datetime]=Query(None),
    end_time:Optional[datetime]=Query(None),
    db: Session = Depends(get_db),
    payload: dict = Depends(token_check),
):
    vehicles = get_available_vehicles_new_ride(db,start_time,end_time,type)


    if type:
        vehicles = [v for v in vehicles if v.type and v.type.lower() == type.lower()]

    if not vehicles:
        return []

    electric, hybrid, fuel = [], [], []

    for v in vehicles:
        if v.fuel_type == "electric":
            km_today = get_vehicle_km_driven_on_date(db, v.id, ride_date or date.today())
            if distance_km + float(km_today) <= 200:
                electric.append(v)
        elif v.fuel_type == "hybrid":
            hybrid.append(v)
        elif v.fuel_type =="gasoline":
            fuel.append(v)

   
    prioritized = []
    if distance_km <= 200 and electric:
        prioritized = electric
    elif hybrid:
        prioritized = hybrid
    elif fuel:
        prioritized = fuel
    elif electric:
        prioritized = electric

    return prioritized

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


@router.patch("/vehicles-status/{vehicle_id}")
async def patch_vehicle_status(
    vehicle_id: UUID,
    status_update: VehicleStatusUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(token_check)
):
    user_id = payload.get("user_id") or payload.get("sub")
    if not user_id:
        return {"error": "User ID not found in token"}, 401
    
    res = update_vehicle_status(
        vehicle_id,
        status_update.new_status,
        status_update.freeze_reason,
        db,
        user_id
    )

    new_status = res["new_status"]

    await sio.emit('vehicle_status_updated', {
        "vehicle_id": str(vehicle_id),
        "status": new_status,
        "freeze_reason": res.get("freeze_reason", "")
    })

    cancelled_result = None
    if new_status == "frozen":   
        cancelled_result =  cancel_future_rides_for_vehicle(vehicle_id, db,user_id)
    
    if cancelled_result is None:
        cancelled_result = {"cancelled": [], "users": []}


    await sio.emit('reservationCanceledDueToVehicleFreeze', {
        "vehicle_id": str(vehicle_id),
        "cancelled_rides": cancelled_result["cancelled"],
        "affected_users": [str(u) for u in cancelled_result["users"]],
        "status": new_status,
        "freeze_reason": res.get("freeze_reason", "")
    })


    if cancelled_result:
        res["cancelled_rides"] = cancelled_result["cancelled"]
        res["affected_users"] = cancelled_result["users"]

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


@router.put("/vehicle/{vehicle_id}")
def update_vehicle_route(
    vehicle_id: str, 
    vehicle_data: VehicleUpdateRequest, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        updated_vehicle = update_vehicle(vehicle_id, vehicle_data, db)
        return updated_vehicle
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/add-vehicle", response_model=VehicleOut, status_code=status.HTTP_201_CREATED)
def create_vehicle(
    vehicle_data: VehicleCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(token_check) 
):
    user_id = payload.get("user_id") or payload.get("sub") or "system"
    db.execute(text("SET LOCAL session.audit.user_id = :user_id"), {"user_id": user_id})
    
    existing_vehicle = db.query(Vehicle).filter_by(plate_number=vehicle_data.plate_number).first()
    if existing_vehicle:
        raise HTTPException(status_code=400, detail="Vehicle with this plate number already exists")
    
    if vehicle_data.department_id:
        if vehicle_data.department_id == "vip":
            vip_dep = get_or_create_vip_department(db, user_id)
            vehicle_data.department_id = str(vip_dep.id)
        else:
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
    

@router.get("/ride/statuses")
def get_ride_statuses(
    db: Session = Depends(get_db),
    payload: dict = Depends(token_check)
):
   try:
        ride_statuses = db.query(Ride.status).distinct().all()
        return {"ride_statuses": [rs[0] for rs in ride_statuses]}
   except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}") 
    



@router.get("/vehicles/{vehicle_id}/timeline", response_model=List[RideTimelineSchema])
def get_vehicle_timeline(
    vehicle_id: UUID,
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    db: Session = Depends(get_db),
):
    start_dt = datetime.combine(from_date, time.min)
    end_dt = datetime.combine(to_date, time.max)

    rides = (
        db.query(
            Ride.vehicle_id,
            Ride.start_datetime,
            Ride.end_datetime,
            Ride.status,
            Ride.user_id,
            User.first_name,
            User.last_name,
        )
        .join(User, Ride.user_id == User.employee_id)
        .filter(
            Ride.vehicle_id == vehicle_id,
            Ride.start_datetime < end_dt,
            Ride.end_datetime > start_dt,
           
        )
        .all()
    )

  
    return [RideTimelineSchema(**dict(row._mapping)) for row in rides]

   
@router.get("/vehicles/inactive", response_model=List[VehicleOut])
def return_inactive_vehicle(db: Session = Depends(get_db)):
    
    now = datetime.now(timezone.utc)
    one_week_ago = now - timedelta(days=7)

    recent_rides_subq = db.query(
        Ride.vehicle_id,
        func.max(Ride.end_datetime).label("last_ride")
    ).filter(
        Ride.status == "completed"
    ).group_by(Ride.vehicle_id).subquery()

    inactive_vehicles = db.query(Vehicle, recent_rides_subq.c.last_ride).outerjoin(
        recent_rides_subq, Vehicle.id == recent_rides_subq.c.vehicle_id
    ).filter(
        or_(
            recent_rides_subq.c.last_ride == None,
            recent_rides_subq.c.last_ride < one_week_ago
        )
    ).all()

    return [v for v, _ in inactive_vehicles]

@router.put("/vehicles/{vehicle_id}/restore")
def restore_vehicle(
    request: Request,
    vehicle_id: UUID,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    user = get_current_user(request)
    role_check(["admin"], token)
    
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id, Vehicle.is_archived == True).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Archived vehicle not found")
    
    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user.employee_id)})

    vehicle.is_archived = False
    vehicle.archived_at = None
    vehicle.status = VehicleStatus.available
    
    db.commit()
    db.execute(text("SET session.audit.user_id = DEFAULT"))
    
    return {"message": f"Vehicle {vehicle.plate_number} restored successfully"}

@router.delete("/vehicles/{vehicle_id}/permanent")
def permanently_delete_vehicle(
    request: Request,
    vehicle_id: UUID,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    user = get_current_user(request)
    role_check(["admin"], token)
    
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id, Vehicle.is_archived == True).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Archived vehicle not found")
    
    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user.employee_id)})

    db.delete(vehicle)
    db.commit()
    db.execute(text("SET session.audit.user_id = DEFAULT"))
    
    return {"message": f"Vehicle {vehicle.plate_number} permanently deleted"}

@router.get("/vehicles/usage-stats-all-time")
async def get_usage_stats_all_time(db: Session = Depends(get_db)):
    try:
        stats_dict = get_most_used_vehicles_all_time(db)
        stats_list = [
            {"vehicle_id": vid, "total_rides": count}
            for vid, count in stats_dict.items()
        ]
        return {"stats": stats_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))