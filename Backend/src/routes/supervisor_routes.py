from fastapi import APIRouter, Depends
from uuid import UUID
from src.services.supervisor_dashboard_service import get_department_orders
from sqlalchemy.orm import Session
from src.schemas.ride_status_enum import UpdateRideStatusRequest
from src.services.user_rides_service import update_ride_status
from src.utils.database import get_db


router = APIRouter()

@router.get("/departments/{department_id}/orders")
def get_department_orders_route(department_id: UUID):
    return get_department_orders(str(department_id))

@router.get("/departments/{department_id}/orders/{order_id}")
def get_department_specific_order(department_id: UUID, order_id: UUID):
    return {"message": f"Order {order_id} from department {department_id}"}

@router.get("/orders/{department_id}/{order_id}/pending")
def get_approval_dashboard(department_id: UUID, order_id: UUID):
    return {"message": f"Approval dashboard for order {order_id} in department {department_id}"}

@router.patch("/orders/{department_id}/{order_id}/update")
def edit_order_status(department_id: UUID, order_id: UUID):
    return {"message": f"Order {order_id} in department {department_id} updated"}

@router.get("/vehicles/{department_id}")
def get_department_vehicles(department_id: UUID):
    return {"message": f"Vehicles for department {department_id}"}

@router.get("/notifications/{department_id}")
def view_department_notifications(department_id: UUID):
    return {"message": f"Notifications for department {department_id}"}

@router.patch("/orders/{department_id}/{ride_id}/update")
def supervisor_update_ride_status(
    department_id: UUID,
    ride_id: UUID,
    req: UpdateRideStatusRequest,
    db: Session = Depends(get_db)
):
    return update_ride_status(ride_id, req.status, db)