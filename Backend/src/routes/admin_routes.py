from fastapi import APIRouter, Depends, HTTPException, Query
from uuid import UUID
from typing import Optional
from typing import List
from datetime import datetime
from sqlalchemy.orm import Session
from src.schemas.user_response_schema import UserResponse, UserUpdate
from src.schemas.ride_dashboard_item import RideDashboardItem
from src.services.user_data import get_user_by_id, get_all_users
from src.services.admin_rides_service import (
    get_all_orders,
    get_future_orders,
    get_past_orders,
    get_orders_by_user,
    get_order_by_ride_id
)
from ..utils.database import get_db
from src.models.user_model import User
from src.models.user_model import UserRole
from ..schemas.check_vehicle_schema import VehicleInspectionSchema
from ..services.vehicle_service import vehicle_inspection_logic
from ..schemas.vehicle_schema import VehicleOut , InUseVehicleOut , VehicleStatusUpdate
from ..utils.auth import token_check
from ..services.vehicle_service import get_vehicles_with_optional_status, get_available_vehicles,update_vehicle_status,get_vehicle_by_id


router = APIRouter()

@router.get("/orders", response_model=list[RideDashboardItem])
def fetch_all_orders(
    status: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    return get_all_orders(db, status=status, from_date=from_date, to_date=to_date)

@router.get("/orders/future", response_model=list[RideDashboardItem])
def fetch_future_orders(
    status: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    return get_future_orders(db, status=status, from_date=from_date, to_date=to_date)

@router.get("/orders/past", response_model=list[RideDashboardItem])
def fetch_past_orders(
    status: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    return get_past_orders(db, status=status, from_date=from_date, to_date=to_date)

@router.get("/orders/user/{user_id}", response_model=list[RideDashboardItem])
def fetch_orders_by_user(user_id: UUID, db: Session = Depends(get_db)):
    return get_orders_by_user(db, user_id=user_id)

@router.get("/orders/ride/{ride_id}", response_model=RideDashboardItem)
def fetch_order_by_ride(ride_id: UUID, db: Session = Depends(get_db)):
    result = get_order_by_ride_id(db, ride_id=ride_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Ride not found")
    return result

@router.get("/user-data", response_model=List[UserResponse])
def fetch_all_users(db: Session = Depends(get_db)):
    users = get_all_users(db)
    if not users:
        raise HTTPException(status_code=404, detail="Users not found")
    return users

@router.get("/user-data/{user_id}", response_model=UserResponse)
def fetch_user_by_id(user_id: UUID, db: Session = Depends(get_db)):
    result = get_user_by_id(db, user_id=user_id)
    if result is None:
        raise HTTPException(status_code=404, detail="User not found")
    return result

@router.patch("/user-data-edit/{user_id}", response_model=UserResponse)
def edit_user_by_id_route(
    user_id: UUID,
    user_update: UserUpdate,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.employee_id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = user_update.dict(exclude_unset=True)
    print("🟡 Incoming update:", update_data)

    # Check attributes before applying them
    for key, value in update_data.items():
        if not hasattr(user, key):
            print(f"⚠️ WARNING: User has no attribute '{key}' — skipping.")
        else:
            print(f"✅ Updating '{key}' to '{value}'")
            setattr(user, key, value)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print("❌ Commit failed:", e)
        raise HTTPException(status_code=500, detail="Failed to update user")

    db.refresh(user)
    return user

@router.get("/roles")
def get_roles():
    return [role.value for role in UserRole]


@router.post("/vehicle-inspection")
def vehicle_inspection(data: VehicleInspectionSchema, db: Session = Depends(get_db),payload: dict = Depends(token_check)):
    try:
        return vehicle_inspection_logic(data, db)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@router.patch("/{vehicle_id}/status")
def patch_vehicle_status(
    vehicle_id: UUID,
    status_update: VehicleStatusUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(token_check)
):
    return update_vehicle_status(vehicle_id, status_update.new_status, status_update.freeze_reason, db)

@router.get("/vehicle/{vehicle_id}")
def get_vehicle_by_id_route(vehicle_id: str, db: Session = Depends(get_db)):
    return get_vehicle_by_id(vehicle_id, db)

@router.get("/all-vehicles/available")
def get_available_vehicles_route(status: Optional[str] = Query(None),
 db: Session = Depends(get_db),payload: dict = Depends(token_check)):
    vehicles = get_available_vehicles(db)
    return vehicles

@router.get("/all-vehicles", response_model=List[VehicleOut])
def get_all_vehicles_route(status: Optional[str] = Query(None), db: Session = Depends(get_db)
    ,payload: dict = Depends(token_check)):
    vehicles = get_vehicles_with_optional_status(db, status)
    return vehicles



@router.get("/inspections/today", response_model=List[VehicleInspectionSchema])
def get_today_inspections(db: Session = Depends(get_db)):
    today = date.today()
    inspections = db.query(VehicleInspection).filter(
        VehicleInspection.inspection_date == today
    ).all()
    return inspections


