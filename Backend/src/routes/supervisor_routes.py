from uuid import UUID
from src.services.supervisor_dashboard_service import get_department_orders,get_department_specific_order
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.utils.database import get_db
from src.models.ride_model import Ride 



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
