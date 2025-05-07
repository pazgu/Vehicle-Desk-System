from fastapi import APIRouter

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