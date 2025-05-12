
from fastapi import APIRouter, HTTPException, status , Depends , Query
from ..schemas.register_schema import UserCreate
from ..schemas.login_schema import UserLogin
from ..schemas.new_ride_schema import RideCreate
from ..services import register_service
from ..services.auth_service import create_access_token
from ..services import login_service
from uuid import UUID
from ..services.new_ride_service import create_ride 
from fastapi.responses import JSONResponse
from typing import List, Optional, Union
from datetime import datetime
from ..utils.mock_data import mock_departments
from ..schemas.user_rides_schema import RideSchema, RideStatusEnum
from ..services.user_rides_service import get_future_rides, get_past_rides , get_all_rides

router = APIRouter()

@router.post("/api/register")
def register_user(user: UserCreate):
    try:
        return register_service.create_user(user)
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed due to an internal error"
        )


@router.post("/api/login")
def login(user: UserLogin):
    return login_service.login_user(user.username, user.password)



@router.get("/api/users/{user_id}/orders")
def get_user_orders():
    return

@router.get("/api/orders/{user_id}/future-orders", response_model=List[RideSchema])
def get_future_orders(
    user_id: int,
    status: Optional[RideStatusEnum] = Query(None),
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None)
):
    rides = get_future_rides(user_id, status, from_date, to_date)
    if not rides:
        if status or from_date or to_date:
            return JSONResponse(status_code=200, content={"message": "אין הזמנות שמתאימות לסינון"})
        raise HTTPException(status_code=404, detail="לא נמצאו נסיעות עתידיות")
    return rides

@router.get("/api/orders/{user_id}/past-orders", response_model=List[RideSchema])
def get_past_orders(
    user_id: int,
    status: Optional[RideStatusEnum] = Query(None),
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None)
):
    rides = get_past_rides(user_id, status, from_date, to_date)
    if not rides:
        if status or from_date or to_date:
            return JSONResponse(status_code=200, content={"message": "אין הזמנות שמתאימות לסינון"})
        raise HTTPException(status_code=404, detail="לא נמצאו נסיעות עבר")
    return rides

@router.get("/api/orders/{user_id}/all-orders", response_model=List[RideSchema])
def get_all_orders(
    user_id: int,
    status: Optional[RideStatusEnum] = Query(None),
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None)
):
    rides = get_all_rides(user_id, status, from_date, to_date)
    if not rides:
        if status or from_date or to_date:
            return JSONResponse(status_code=200, content={"message": "אין הזמנות שמתאימות לסינון"})
        raise HTTPException(status_code=404, detail="לא נמצאו הזמנות")
    return rides

@router.get("/api/user-orders/{user_id}/{order_id}")
def get_user_2specific_order():
    return

@router.post("/api/orders/{user_id}", response_model=RideCreate, status_code=status.HTTP_201_CREATED)
def create_order(user_id: UUID, ride_request: RideCreate):
    try:
        new_ride = create_ride(user_id, ride_request)
        return new_ride
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create order: {str(e)}"
        )
   


@router.get("/api/departments")
def get_departments():
    return mock_departments

@router.patch("/api/orders/{user_id}")
def update_order():
    return

@router.delete("/api/orders/{user_id}")
def delete_order():
    return

@router.get("/api/notifications/{user_id}")
def view_notifications():
    return