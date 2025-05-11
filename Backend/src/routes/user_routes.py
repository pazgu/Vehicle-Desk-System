from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from ..schemas.register_schema import UserCreate
from ..schemas.login_schema import UserLogin
from ..schemas.new_ride_schema import RideCreate
from ..services import register_service
from ..services.auth_service import create_access_token
from ..services import login_service
from uuid import UUID
from ..services.new_ride_service import create_ride
from src.utils.database import get_db
import logging
import traceback

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
def login(user: UserLogin):
    try:
        return login_service.login_user(user.username, user.password)
    except Exception as e:
        logger.error(f"Login failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Login failed: {str(e)}"
        )

@router.get("/api/users/{user_id}/orders")
def get_user_orders():
    # Implementation pending
    return {"message": "Not implemented yet"}

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