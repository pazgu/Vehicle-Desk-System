from sqlalchemy.orm import Session
from ..models.ride_model import Ride
from ..schemas.order_card_item import OrderCardItem
from fastapi import HTTPException
from uuid import UUID

def patch_order_in_db(order_id: UUID, patch_data: OrderCardItem, db: Session):
    order = db.query(Ride).filter(Ride.id == order_id).first()

    if not order:
        raise HTTPException(status_code=404, detail="ההזמנה לא נמצאה")

    data = patch_data.dict(exclude_unset=True)

    for key, value in data.items():
        setattr(order, key, value)

    db.commit()
    db.refresh(order)
    return order