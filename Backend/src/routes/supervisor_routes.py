from uuid import UUID
from src.services.supervisor_dashboard_service import get_department_orders,get_department_specific_order,edit_order_status
from fastapi import APIRouter, Depends ,  Query
from sqlalchemy.orm import Session
from src.utils.database import get_db
from src.models.ride_model import Ride 
from ..schemas.vehicle_schema import VehicleOut , InUseVehicleOut
from ..models.vehicle_model import VehicleType
from ..services.vehicle_service import get_vehicles_with_optional_status
# get_available_vehicles as fetch_available_vehicles, get_in_use_vehicles, get_frozen_vehicles , get_vehicles_with_optional_status
from typing import List, Optional, Union


router = APIRouter()


@router.get("/orders/{department_id}")
def get_department_orders_route(department_id: UUID, db: Session = Depends(get_db)):
    return get_department_orders(str(department_id), db)

@router.get("/orders/{department_id}/{order_id}")
def get_department_specific_order_route(department_id: UUID, order_id: UUID, db: Session = Depends(get_db)):
    order = get_department_specific_order(department_id, order_id, db)

    if not order:
        return {"error": "Order not found"}, 404
    return order

@router.get("/orders/{department_id}/{order_id}/pending")
def get_approval_dashboard_route(department_id: UUID, order_id: UUID):
    return {"message": f"Approval dashboard for order {order_id} in department {department_id}"}

@router.patch("/orders/{department_id}/{order_id}/update/{status}")
def edit_order_status_route(department_id: UUID, order_id: UUID, status: str, db: Session = Depends(get_db)):
    return edit_order_status(department_id, order_id, status, db)

@router.get("/vehicles/{department_id}")
def get_department_vehicles_route(department_id: UUID):
    return {"message": f"Vehicles for department {department_id}"}

@router.get("/notifications/{department_id}")
def view_department_notifications_route(department_id: UUID):
    return {"message": f"Notifications for department {department_id}"}

@router.get("/available-vehicles", response_model=List[VehicleOut])
def available_vehicles(
    type: Optional[VehicleType] = Query(None),
    db: Session = Depends(get_db)
):
    return fetch_available_vehicles(db=db, type=type)

@router.get("/in-use-vehicles", response_model=List[InUseVehicleOut])
def in_use_vehicles( db: Session = Depends(get_db)):
    return get_in_use_vehicles(db=db)

@router.get("/frozen-vehicles", response_model=List[VehicleOut])
def frozen_vehicles(
    type: Optional[VehicleType] = Query(None),
    db: Session = Depends(get_db)
):
    return get_frozen_vehicles(db=db, type=type)

@router.get("/all-vehicles")
def read_vehicles(status: Optional[str] = Query(None), db: Session = Depends(get_db)):
    vehicles = get_vehicles_with_optional_status(db, status)

    if status == "in_use":
        validated = [InUseVehicleOut(**v) if isinstance(v, dict) else v for v in vehicles]
    else:
        validated = [VehicleOut(**v) if isinstance(v, dict) else v for v in vehicles]

    return validated
