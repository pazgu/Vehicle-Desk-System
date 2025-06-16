from fastapi import APIRouter, Depends, HTTPException
from src.utils.auth import token_check
from fastapi import APIRouter, Depends
from uuid import UUID
from sqlalchemy import select

from src.services.supervisor_dashboard_service import (
    get_department_orders,
    get_department_specific_order,
    edit_order_status,
)
from sqlalchemy.orm import Session
from src.utils.database import get_db
from ..utils.database import get_db
from ..services.supervisor_dashboard_service import get_department_orders
from typing import Optional
from ..schemas.order_card_item import OrderCardItem
from ..schemas.check_vehicle_schema import VehicleInspectionSchema
from ..services.supervisor_dashboard_service import vehicle_inspection_logic , start_ride
from ..schemas.vehicle_schema import FreezeVehicleRequest
from ..utils.socket_manager import sio 
from ..utils.socket_utils import convert_decimal
from ..models.vehicle_model import Vehicle
from ..models.user_model import User
import json
from ..models.ride_model import Ride

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
async def update_order_status_route( # Renamed for clarity, but you can keep edit_order_status_route if you prefer
    department_id: UUID,
    order_id: UUID,
    status: str,
    db: Session = Depends(get_db),
    payload: dict = Depends(token_check), # Inject the token payload
):
    # Extract supervisor_id from the token payload
    supervisor_id = payload.get("user_id") or payload.get("sub")
    if not supervisor_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Supervisor ID not found in token")

    # Pass all required arguments to edit_order_status
    updated_order, notification = edit_order_status(department_id, order_id, status, supervisor_id, db)

    if not updated_order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    # Prepare order data for emission
    user = db.query(User).filter(User.employee_id == updated_order.user_id).first()
    vehicle = db.query(Vehicle).filter(Vehicle.id == updated_order.vehicle_id).first()

    order_data = {
        "id": str(updated_order.id),
        "user_id": str(updated_order.user_id),
        "employee_name": f"{user.first_name} {user.last_name}",
        "vehicle_id": str(updated_order.vehicle_id) if updated_order.vehicle_id else None,
        "requested_vehicle_plate": vehicle.plate_number,
        "ride_type": updated_order.ride_type,
        "start_datetime": updated_order.start_datetime,
        "end_datetime": updated_order.end_datetime,
        "start_location": updated_order.start_location,
        "stop": updated_order.stop,
        "destination": updated_order.destination,
        "estimated_distance_km": updated_order.estimated_distance_km,
        "actual_distance_km": updated_order.actual_distance_km,
        "status": updated_order.status.value,
        "license_check_passed": updated_order.license_check_passed,
        "submitted_at": updated_order.submitted_at,
        "emergency_event": updated_order.emergency_event,
    }
    print("Order data to emit:", json.dumps(convert_decimal(order_data), indent=2))
    await sio.emit("order_updated", convert_decimal(order_data))

    # 🔔 Emit notification to the user (if created)
    if notification:
        await sio.emit("new_notification", {
            "id": str(notification.id),
            "user_id": str(notification.user_id),
            "title": notification.title,
            "message": notification.message,
            "notification_type": notification.notification_type.value,
            "sent_at": notification.sent_at.isoformat(),
            "order_id": str(notification.order_id) if notification.order_id else None,
            "order_status": updated_order.status
        })

    return {"message": "הסטטוס עודכן בהצלחה"}


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





# @router.post("/vehicle-inspection")
# def vehicle_inspection(data: VehicleInspectionSchema, db: Session = Depends(get_db)):
#     try:
#         return vehicle_inspection_logic(data, db)
#     except HTTPException as e:
#         raise e
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))


# @router.post("/vehicles/freeze")
# def freeze_vehicle(request: FreezeVehicleRequest, db: Session = Depends(get_db)):
#     return freeze_vehicle_service(db, request.vehicle_id, request.reason)

# @router.post("/rides/{ride_id}/start")
# def start_ride_route(ride_id: UUID, db: Session = Depends(get_db)):
#     try:
#         start_ride(db, ride_id)
#         return {"message": "Ride started, vehicle marked as in use"}
#     except ValueError as e:
#         raise HTTPException(status_code=400, detail=str(e))
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
