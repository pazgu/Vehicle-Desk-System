from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..models.city_model import City
from ..models.ride_model import Ride
from ..models.user_model import User
from ..schemas.order_card_item import OrderCardItem
from ..schemas.user_response_schema import UserUpdate


async def patch_order_in_db(order_id: UUID, patch_data: OrderCardItem, db: Session, changed_by: str):
    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(changed_by)})

    order = db.query(Ride).filter(Ride.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="ההזמנה לא נמצאה")
    if order.status == "APPROVED":
        raise HTTPException(status_code=400, detail="אי אפשר לערוך הזמנה שאושרה. ניתן רק לבטל ולהזמין חדשה.")

    # Save the original status to check for changes
    original_status = order.status

    data = patch_data.dict(exclude_unset=True)
    for key, value in data.items():
        setattr(order, key, value)

    db.commit()
    db.refresh(order)

    # ✅ Only send email if status changed AND is now approved/rejected
    if "status" in data and order.status != original_status and order.status.value in ["APPROVED", "REJECTED"]:
        employee = db.query(User).filter(User.employee_id == order.user_id).first()
        # employee_email = get_user_email(order.user_id, db)
        destination_city = db.query(City).filter(City.id == order.stop).first()
        destination_name = destination_city.name if destination_city else order.stop

        # if employee_email:
        #     template_name = "ride_approved.html" if order.status.value == "APPROVED" else "ride_rejected.html"

        #     html_content = load_email_template(template_name, {
        #         "EMPLOYEE_NAME": f"{employee.first_name} {employee.last_name}" if employee else "משתמש",
        #         "DESTINATION": destination_name,
        #         "DATE_TIME": str(order.start_datetime),
        #         "PLATE_NUMBER": order.plate_number or "לא נבחר",
        #         "DISTANCE": str(order.estimated_distance_km),
        #         "APPROVER_NAME": "המנהל שלך",  # You can replace with actual name if needed
        #         "REJECTION_REASON": order.emergency_event or "לא צוין"
        #     })

        #     await async_send_email(
        #         to_email=employee_email,
        #         subject="✅ הנסיעה שלך אושרה" if order.status.value == "APPROVED" else "❌ הבקשה שלך נדחתה",
        #         html_content=html_content
        #     )

    return order

def edit_user_by_id(db: Session, user_id: UUID, user_update: UserUpdate):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        return None

    for field, value in user_update.dict(exclude_unset=True).items():
        setattr(user, field, value)
    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user.employee_id)})    

    db.commit()
    db.refresh(user)
    return user

