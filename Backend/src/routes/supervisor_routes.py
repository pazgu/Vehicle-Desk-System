from src.utils.auth import token_check
from fastapi import APIRouter, Depends
from uuid import UUID
from src.services.supervisor_dashboard_service import (
    get_department_orders,
    get_department_specific_order,
    edit_order_status,
)
from sqlalchemy.orm import Session
from src.utils.database import get_db

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

@router.patch("/orders/{department_id}/{order_id}/update/{status}")
def update_order_status_route(
    department_id: UUID,
    order_id: UUID,
    status: str,
    db: Session = Depends(get_db),
    payload: dict = Depends(token_check),
):
    # Use the correct key for supervisor ID from your token_check
    supervisor_id = payload.get("user_id") or payload.get("sub")
    if not supervisor_id:
        return {"error": "Supervisor ID not found in token"}, 401
    return edit_order_status(department_id, order_id, status, supervisor_id, db)

# from src.utils.auth import token_check
# from fastapi import APIRouter, Depends
# from uuid import UUID
# from src.services.supervisor_dashboard_service import get_department_orders,get_department_specific_order,edit_order_status
# from sqlalchemy.orm import Session
# from src.models.ride_model import Ride 
# from src.utils.database import get_db
# from ..utils.database import get_db
# from ..services.supervisor_dashboard_service import get_department_orders
# from typing import Optional
# from ..schemas.order_card_item import OrderCardItem
# from ..schemas.check_vehicle_schema import VehicleInspectionSchema
# from ..services.supervisor_dashboard_service import vehicle_inspection_logic , start_ride
# from ..schemas.vehicle_schema import FreezeVehicleRequest

# router = APIRouter()


# @router.get("/orders/{department_id}")
# def get_department_orders_route(department_id: UUID, db: Session = Depends(get_db)):
#     return get_department_orders(str(department_id), db)

# @router.get("/orders/{department_id}/{order_id}")
# def get_department_specific_order_route(department_id: UUID, order_id: UUID, db: Session = Depends(get_db)):
#     order = get_department_specific_order(department_id, order_id, db)

#     if not order:
#         return {"error": "Order not found"}, 404
#     return order

# @router.patch("/orders/{department_id}/{order_id}/update/{status}")
# def update_order_status_route(department_id: UUID, order_id: UUID, status: str, db: Session = Depends(get_db), payload: dict = Depends(token_check)):
#     supervisor_id = payload["sub"]
#     return edit_order_status(department_id, order_id, status, supervisor_id, db)
