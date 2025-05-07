from fastapi import APIRouter, HTTPException, status
from ..schemas.register_schema import UserCreate
from ..schemas.login_schema import UserLogin
from ..services import register_service
from ..services.auth_service import create_access_token
from ..services import login_service

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

@router.get("/api/user-orders/{user_id}/{order_id}")
def get_user_2specific_order():
    return

@router.post("/api/orders/{user_id}")
def add_order():
    return

@router.patch("/api/orders/{user_id}")
def update_order():
    return

@router.delete("/api/orders/{user_id}")
def delete_order():
    return

@router.get("/api/notifications/{user_id}")
def view_notifications():
    return