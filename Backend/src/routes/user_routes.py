from fastapi import APIRouter, HTTPException, Depends , Query
from sqlalchemy.orm import Session
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
from ..schemas.user_rides_schema import RideSchema, RideStatus
from ..services.user_rides_service import get_future_rides, get_past_rides , get_all_rides
from ..utils.database import get_db
from src.models import ride_model, vehicle_model
import logging
from ..utils.database import get_db
from ..services.register_service import get_departments 
from ..schemas.notification_schema import NotificationOut
from ..services.user_notification import get_user_notifications
from fastapi import status as fastapi_status
from fastapi.security import OAuth2PasswordBearer
from ..utils.auth import role_check,identity_check,get_current_user



oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

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
            status_code=fastapi_status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        # Log the full traceback for debugging
        logger.error(f"Registration failed with error: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=fastapi_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"  # Return the actual error for debugging
        )
    



        
@router.post("/api/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    try:
        return login_service.login_user(user.username, user.password, db)
    except Exception as e:
        logger.error(f"Login failed: {str(e)}")
        raise HTTPException(
            status_code=fastapi_status.HTTP_401_UNAUTHORIZED,
            detail="Login failed: Incorrect username or password."  # Hide internal errors for security
        )
    



@router.get("/api/users/{user_id}/orders")
def get_user_orders():
     # Implementation pending
    return {"message": "Not implemented yet"}
    


@router.get("/api/future-orders/{user_id}", response_model=List[RideSchema])
def get_future_orders(user_id: UUID, status: Optional[RideStatus] = Query(None),
                      from_date: Optional[datetime] = Query(None),
                      to_date: Optional[datetime] = Query(None),
                      db: Session = Depends(get_db),
                      token: str = Depends(oauth2_scheme)):

    try:
        # First, check if the user has the required role
        role_check(allowed_roles=["employee", "admin"], token=token)

        # Then, check if the user is trying to access their own data
        identity_check(user_id=str(user_id), token=token)                  

        # Fetch future rides based on the user's request
        rides = get_future_rides(user_id, db, status, from_date, to_date)

        # Return appropriate message if no rides are found
        if not rides:
            if status or from_date or to_date:
                return JSONResponse(status_code=200, content={"message": "No rides match the given filters."})
            return JSONResponse(status_code=200, content={"message": "No future rides found."})

        return rides

    except HTTPException as e:
        # Handle role or identity check errors
        raise e  # This will propagate the 403 Forbidden exception if raised

    except Exception as e:
        # Catch unexpected errors and return a 500 Internal Server Error
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")




@router.get("/api/past-orders/{user_id}", response_model=List[RideSchema])
def get_past_orders(user_id: UUID, status: Optional[RideStatus] = Query(None),
                    from_date: Optional[datetime] = Query(None),
                    to_date: Optional[datetime] = Query(None),
                    db: Session = Depends(get_db),
                    token: str = Depends(oauth2_scheme)):
    
    role_check(["employee", "admin"], token)
    identity_check(str(user_id), token)

    rides = get_past_rides(user_id, db, status, from_date, to_date)
    if not rides:
        if status or from_date or to_date:
            return JSONResponse(status_code=200, content={"message": "אין הזמנות שמתאימות לסינון"})
        return JSONResponse(status_code=200, content={"message": "לא נמצאו הזמנות עבר"})

    return rides




@router.get("/api/all-orders/{user_id}", response_model=List[RideSchema])
def get_all_orders(user_id: UUID, status: Optional[RideStatus] = Query(None),
                   from_date: Optional[datetime] = Query(None),
                   to_date: Optional[datetime] = Query(None),
                   db: Session = Depends(get_db),
                   token: str = Depends(oauth2_scheme)):
    role_check(["employee", "admin"], token)
    identity_check(str(user_id), token)

    rides = get_all_rides(user_id, db, status, from_date, to_date)
    if not rides:
        if status or from_date or to_date:
            return JSONResponse(status_code=200, content={"message": "אין הזמנות שמתאימות לסינון"})
        return JSONResponse(status_code=200, content={"message": "לא נמצאו הזמנות"})

    return rides

@router.get("/api/user-orders/{user_id}/{order_id}")
def get_user_2specific_order():
    # Implementation pending
    return {"message": "Not implemented yet"}

@router.post("/api/orders/{user_id}", response_model=RideCreate, status_code=fastapi_status.HTTP_201_CREATED)
def create_order(user_id: UUID, ride_request: RideCreate, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):

    # Check if user has the right role
    role_check(allowed_roles=["employee", "admin"], token=token)

    # Check if this user is creating their own order
    identity_check(user_id=str(user_id), token=token)

    try:
        new_ride = create_ride(db, user_id, ride_request)
        return new_ride
    except Exception as e:
        logger.error(f"Order creation failed: {str(e)}")
        raise HTTPException(
            status_code=fastapi_status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create order: {str(e)}"
        )
   


@router.get("/api/departments")
def get_departments_route():
    return get_departments()

@router.patch("/api/orders/{user_id}")
def update_order():
    # Implementation pending
    return {"message": "Not implemented yet"}


#send a notification to a user
@router.post("/api/notification/{user_id}")
def send_notification_route():
    # Implementation pending
    return {"message": "Not implemented yet"}


@router.get("/api/notifications/{user_id}", response_model=list[NotificationOut])
def get_notifications_for_user(user_id: UUID, db: Session = Depends(get_db)):
    return get_user_notifications(db, user_id)

@router.get("/api/notification/{notification_id}/{user_id}")
def get_notification_route():
    # Implementation pending
    return {"message": "Not implemented yet"}

@router.delete("/api/orders/{user_id}")
def delete_order():
    # Implementation pending
    return {"message": "Not implemented yet"}

