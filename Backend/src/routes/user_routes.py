from fastapi import APIRouter, HTTPException, status
from ..schemas.register_schema import UserCreate
from ..services import register_service
from ..services.auth_service import create_access_token

router = APIRouter()

@router.post("/api/register")
def register_user(user: UserCreate):
    try:
        new_user = register_service.create_user(user)
        access_token = create_access_token(
            data={"sub": str(new_user["id"]), "role": new_user["role"]}
        )
        return {
            "message": "User registered successfully",
            "user_id": new_user["id"],
            "access_token": access_token,
            "token_type": "bearer"
        }
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