from fastapi import APIRouter, HTTPException, status, Depends , Query
from sqlalchemy.orm import Session
from ..schemas.register_schema import UserCreate
from ..schemas.login_schema import UserLogin
from ..schemas.new_ride_schema import RideCreate
from ..services import register_service
from ..services.auth_service import create_access_token
from ..services import login_service
from uuid import UUID
from ..services.new_ride_service import create_ride
from ..services.future_rides_service import get_future_rides_for_user  
from ..schemas.future_rides_schema import FutureRides , RideStatus
from fastapi.responses import JSONResponse
from typing import List, Optional, Union
from datetime import datetime
from ..utils.mock_data import mock_departments
from src.utils.database import get_db
import logging
import traceback
from ..services.register_service import get_departments


# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/api/register")
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    try:
        logger.info(f"Registration attempt for user: {user.username}")
        return register_service.create_user(user, db)
    except ValueError as ve:
        logger.warning(f"Registration validation error: {str(ve)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        # Log the full traceback for debugging
        logger.error(f"Registration failed with error: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"  # Return the actual error for debugging
        )
        
@router.post("/api/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    try:
        return login_service.login_user(user.username, user.password, db)
    except Exception as e:
        logger.error(f"Login failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Login failed: Incorrect username or password."  # Hide internal errors for security
        )

@router.get("/api/users/{user_id}/orders")
def get_user_orders():
     # Implementation pending
    return {"message": "Not implemented yet"}
    

# @router.get("/api/orders/{user_id}/future-orders", response_model=List[FutureRides])
# def get_orders_for_user(user_id: int):
#     future_rides = get_future_rides_for_user(user_id)
#     future_rides.sort(key=lambda ride: ride.start_datetime)
#     if not future_rides:
#         raise HTTPException(status_code=404, detail="No future rides found for the user.")
#     return future_rides

@router.get("/api/orders/{user_id}/future-orders", response_model=List[FutureRides])
def get_orders_for_user(
    user_id: int,
    status: Optional[RideStatus] = Query(None),
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None)
):
    future_rides = get_future_rides_for_user(user_id, status, from_date, to_date)

    if not future_rides:
        if status or from_date or to_date:
            return JSONResponse(
            status_code=200,
            content={"message": "אין הזמנות שמתאימות לסינון"}
            )
        else:
            raise HTTPException(status_code=404, detail="No future rides found for the user.")
    return future_rides



@router.get("/api/user-orders/{user_id}/{order_id}")
def get_user_2specific_order():
    # Implementation pending
    return {"message": "Not implemented yet"}

@router.post("/api/orders/{user_id}", response_model=RideCreate, status_code=status.HTTP_201_CREATED)
def create_order(user_id: UUID, ride_request: RideCreate):
    try:
        new_ride = create_ride(user_id, ride_request)
        return new_ride
    except Exception as e:
        logger.error(f"Order creation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create order: {str(e)}"
        )
   


@router.get("/api/departments")
def get_departments_route():
    return get_departments()

@router.patch("/api/orders/{user_id}")
def update_order():
    # Implementation pending
    return {"message": "Not implemented yet"}

@router.delete("/api/orders/{user_id}")
def delete_order():
    # Implementation pending
    return {"message": "Not implemented yet"}

@router.get("/api/notifications/{user_id}")
def view_notifications():
    # Implementation pending
    return {"message": "Not implemented yet"}