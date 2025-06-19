from sqlalchemy import text
from sqlalchemy.orm import Session
from ..models.ride_model import Ride
from ..schemas.order_card_item import OrderCardItem
from fastapi import HTTPException
from uuid import UUID
from ..models.user_model import User
from ..schemas.user_response_schema import UserUpdate

def patch_order_in_db(order_id: UUID, patch_data: OrderCardItem, db: Session, changed_by: str):
    # Set the session variable for the trigger
    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(changed_by)})

    order = db.query(Ride).filter(Ride.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="ההזמנה לא נמצאה")
    if order.status == "APPROVED":
        raise HTTPException(status_code=400, detail="אי אפשר לערוך הזמנה שאושרה. ניתן רק לבטל ולהזמין חדשה.")

    data = patch_data.dict(exclude_unset=True)
    for key, value in data.items():
        setattr(order, key, value)

    db.commit()
    db.refresh(order)
    return order

def edit_user_by_id(db: Session, user_id: UUID, user_update: UserUpdate):
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        return None
    
    for field, value in user_update.dict(exclude_unset=True).items():
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    return user