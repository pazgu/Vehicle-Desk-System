from uuid import UUID
from src.services.supervisor_dashboard_service import get_department_orders,get_department_specific_order,edit_order_status, get_department_notifications
from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session
from src.utils.database import get_db
from src.models.ride_model import Ride 

from typing import List
from uuid import UUID

from src.schemas.notification_schema import NotificationOut  # adjust path as needed
from src.services.supervisor_dashboard_service import get_department_notifications
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

@router.get("/orders/{department_id}/{order_id}/pending")
def get_approval_dashboard_route(department_id: UUID, order_id: UUID):
    return {"message": f"Approval dashboard for order {order_id} in department {department_id}"}

@router.patch("/orders/{department_id}/{order_id}/update/{status}")
def edit_order_status_route(department_id: UUID, order_id: UUID, status: str, db: Session = Depends(get_db)):
    return edit_order_status(department_id, order_id, status, db)

@router.get("/vehicles/{department_id}")
def get_department_vehicles_route(department_id: UUID):
    return {"message": f"Vehicles for department {department_id}"}

@router.get("/notifications/{department_id}", response_model=List[NotificationOut])
def view_department_notifications_route(department_id: UUID, db: Session = Depends(get_db)):
    notifications = get_department_notifications(department_id, db)
    if notifications is None or len(notifications) == 0:
        raise HTTPException(status_code=404, detail="Notifications not found")
    return notifications
