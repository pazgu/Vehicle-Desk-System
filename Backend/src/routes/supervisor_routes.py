import logging
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi import status as fastapi_status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

# Utils
from ..utils.auth import identity_check, role_check, supervisor_check, token_check
from ..utils.database import get_db  # or use: from src.utils.database import get_db
from ..utils.scheduler import schedule_ride_start
from ..utils.socket_manager import sio
from ..utils.time_utils import is_time_in_blocked_window

# Services
from ..services.new_ride_service import create_supervisor_ride,check_department_assignment
from ..services.ride_reminder_service import schedule_ride_reminder_email
from ..services.supervisor_dashboard_service import (
    get_department_orders,
    get_department_specific_order,
    edit_order_status,
    vehicle_inspection_logic,
    start_ride
)
from ..services.user_data import get_user_department
from ..services.user_notification import create_system_notification
from ..services.vehicle_service import freeze_vehicle_service

# Schemas
from ..schemas.check_vehicle_schema import VehicleInspectionSchema
from ..schemas.new_ride_schema import RideCreate, RideResponse
from ..schemas.order_card_item import OrderCardItem
from ..schemas.vehicle_schema import FreezeVehicleRequest

# Models
from src.models.ride_model import Ride

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
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
async def edit_order_status_route(department_id: UUID, order_id: UUID, status: str, db: Session = Depends(get_db),payload: dict = Depends(token_check)):
    user_id = payload.get("user_id") or payload.get("sub")
    return await edit_order_status(department_id, order_id, status,user_id, db)



@router.post("/supervisor-orders/{user_id}", status_code=fastapi_status.HTTP_201_CREATED)
async def create_order(
    user_id: UUID,
    ride_request: RideCreate,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    role_check(allowed_roles=["supervisor", "admin"], token=token)
    identity_check(user_id=str(user_id), token=token)
    check_department_assignment(db, user_id)

    try:
        new_ride = await create_supervisor_ride(db, user_id, ride_request)
        schedule_ride_start(new_ride.id, new_ride.start_datetime)
        schedule_ride_reminder_email(new_ride.id, new_ride.start_datetime)
        warning_flag = is_time_in_blocked_window(new_ride.start_datetime)
        department_id = get_user_department(user_id=user_id, db=db)

        await sio.emit("new_ride_request", {
            "ride_id": str(new_ride.id),
            "user_id": str(user_id),
            "employee_name": new_ride.username,
            "status": new_ride.status,
            "destination": new_ride.stop,
            "end_datetime": str(new_ride.end_datetime),
            "date_and_time": str(new_ride.start_datetime),
            "vehicle_id": str(new_ride.vehicle_id),
            "requested_vehicle_model": new_ride.vehicle_model,
            "department_id": str(department_id),
            "distance": new_ride.estimated_distance_km,
        })

        return {
            **RideResponse.model_validate(new_ride).dict(),
            "inspector_warning": warning_flag
        }

    except Exception as e:
        logger.error(f"Order creation failed: {str(e)}")
        raise HTTPException(
            status_code=fastapi_status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create order: {str(e)}"
        )


@router.post("/vehicle-inspection")
def vehicle_inspection(data: VehicleInspectionSchema, db: Session = Depends(get_db),payload: dict = Depends(token_check)):
    try:
        return vehicle_inspection_logic(data, db)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vehicles/freeze")
def freeze_vehicle(request: FreezeVehicleRequest, db: Session = Depends(get_db), payload: dict = Depends(token_check)):
    user_id = payload.get("user_id")
    return freeze_vehicle_service(db, request.vehicle_id, request.reason, user_id)

@router.post("/rides/{ride_id}/start")
async def start_ride_route(ride_id: UUID, db: Session = Depends(get_db)):
    try:
        ride, vehicle = await start_ride(db, ride_id)
       
        await sio.emit("ride_status_updated", {
            "ride_id": str(ride.id),
            "new_status": ride.status.value
        })
        await sio.emit("vehicle_status_updated", {
            "id": str(vehicle.id),
            "status": vehicle.status.value
        })

        return {
            "message": "Ride started, vehicle marked as in use",
            "ride_id": str(ride.id),
            "vehicle_id": str(vehicle.id),
            "status": ride.status.value
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
