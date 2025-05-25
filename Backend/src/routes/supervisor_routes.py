from fastapi import APIRouter, Depends , HTTPException,Query
from uuid import UUID
from src.services.supervisor_dashboard_service import get_department_orders,get_department_specific_order,edit_order_status
from sqlalchemy.orm import Session
from src.models.ride_model import Ride 
from src.utils.database import get_db
from ..schemas.vehicle_schema import VehicleOut , InUseVehicleOut , VehicleStatusUpdate
from ..models.vehicle_model import VehicleType
from ..services.vehicle_service import get_vehicles_with_optional_status, get_available_vehicles, update_vehicle_status
# get_available_vehicles as fetch_available_vehicles, get_in_use_vehicles, get_frozen_vehicles , get_vehicles_with_optional_status
from typing import List, Optional, Union
from src.schemas.notification_schema import NotificationOut  # adjust path as needed
from ..schemas.order_card_item import OrderCardItem
from ..services.supervisor_dashboard_service import end_ride_service
from ..schemas.check_vehicle_schema import VehicleInspectionSchema
from ..services.supervisor_dashboard_service import complete_ride_logic
from ..utils.auth import supervisor_check, token_check
router = APIRouter()


@router.get("/orders/{department_id}")
def get_department_orders_route(department_id: UUID, db: Session = Depends(get_db),payload: dict = Depends(token_check)):
    return get_department_orders(str(department_id), db)

@router.get("/orders/{department_id}/{order_id}")
def get_department_specific_order_route(department_id: UUID, order_id: UUID, db: Session = Depends(get_db),payload: dict = Depends(token_check)):
    order = get_department_specific_order(department_id, order_id, db)

    if not order:
        return {"error": "Order not found"}, 404
    return order

@router.patch("/orders/{department_id}/{order_id}/update/{status}")
def edit_order_status_route(department_id: UUID, order_id: UUID, status: str, db: Session = Depends(get_db),payload: dict = Depends(token_check)):
    return edit_order_status(department_id, order_id, status, db)

@router.get("/all-vehicles")
def get_all_vehicles_route(status: Optional[str] = Query(None), db: Session = Depends(get_db)
    ,payload: dict = Depends(token_check)):
    vehicles = get_vehicles_with_optional_status(db, status)

    if status == "in_use":
        validated = [InUseVehicleOut(**v) if isinstance(v, dict) else v for v in vehicles]
    else:
        validated = [VehicleOut(**v) if isinstance(v, dict) else v for v in vehicles]

    return validated

@router.get("/all-vehicles/available")
def get_available_vehicles_route(status: Optional[str] = Query(None),
 db: Session = Depends(get_db),payload: dict = Depends(token_check)):
    vehicles = get_available_vehicles(db)
    return vehicles



@router.patch("/{vehicle_id}/status")
def patch_vehicle_status(
    vehicle_id: UUID,
    status_update: VehicleStatusUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(token_check)
):
    return update_vehicle_status(vehicle_id, status_update.new_status, db)

# @router.get("/orders/{department_id}/{order_id}/pending")
# def get_approval_dashboard_route(department_id: UUID, order_id: UUID):
#     return {"message": f"Approval dashboard for order {order_id} in department {department_id}"}

# @router.get("/vehicles/{department_id}")
# def get_department_vehicles_route(department_id: UUID):
#     return {"message": f"Vehicles for department {department_id}"}
# @router.get("/vehicles/{department_id}")
# def get_department_vehicles_route(department_id: UUID):
#     return {"message": f"Vehicles for department {department_id}"}

# @router.get("/notifications/{department_id}")
# def view_department_notifications_route(department_id: UUID):
#     return {"message": f"Notifications for department {department_id}"}
# @router.get("/notifications/{department_id}")
# def view_department_notifications_route(department_id: UUID):
#     return {"message": f"Notifications for department {department_id}"}

# @router.patch("/orders/{department_id}/{ride_id}/update")
# def supervisor_update_ride_status(
#     department_id: UUID,
#     ride_id: UUID,
#     req: UpdateRideStatusRequest,
#     db: Session = Depends(get_db)
# ):
#     return update_ride_status(ride_id, req.status, db)
# @router.get("/available-vehicles", response_model=List[VehicleOut])
# def available_vehicles(
#     type: Optional[VehicleType] = Query(None),
#     db: Session = Depends(get_db)
# ):
#     return fetch_available_vehicles(db=db, type=type)
# @router.patch("/orders/{department_id}/{ride_id}/update")
# def supervisor_update_ride_status(
#     department_id: UUID,
#     ride_id: UUID,
#     req: UpdateRideStatusRequest,
#     db: Session = Depends(get_db)
# ):
#     return update_ride_status(ride_id, req.status, db)
# @router.get("/available-vehicles", response_model=List[VehicleOut])
# def available_vehicles(
#     type: Optional[VehicleType] = Query(None),
#     db: Session = Depends(get_db)
# ):
#     return fetch_available_vehicles(db=db, type=type)

# @router.get("/in-use-vehicles", response_model=List[InUseVehicleOut])
# def in_use_vehicles( db: Session = Depends(get_db)):
#     return get_in_use_vehicles(db=db)
# @router.get("/in-use-vehicles", response_model=List[InUseVehicleOut])
# def in_use_vehicles( db: Session = Depends(get_db)):
#     return get_in_use_vehicles(db=db)

# @router.get("/frozen-vehicles", response_model=List[VehicleOut])
# def frozen_vehicles(
#     type: Optional[VehicleType] = Query(None),
#     db: Session = Depends(get_db)
# ):
#     return get_frozen_vehicles(db=db, type=type)
# @router.get("/frozen-vehicles", response_model=List[VehicleOut])
# def frozen_vehicles(
#     type: Optional[VehicleType] = Query(None),
#     db: Session = Depends(get_db)
# ):
#     return get_frozen_vehicles(db=db, type=type)




@router.post("/{ride_id}/end", response_model=OrderCardItem)
def end_ride(ride_id: UUID, has_incident: Optional[bool] = False, db: Session = Depends(get_db),payload: dict = Depends(token_check)):
    return end_ride_service(db=db, ride_id=ride_id, has_incident=has_incident)


@router.post("/ride/complete")
def complete_ride(data: VehicleInspectionSchema, db: Session = Depends(get_db),payload: dict = Depends(token_check)):
    try:
        return complete_ride_logic(data, db)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))