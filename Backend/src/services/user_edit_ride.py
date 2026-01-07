from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..models.city_model import City
from ..models.ride_model import Ride,RideStatus
from ..models.user_model import User
from ..models.vehicle_model import Vehicle
from ..schemas.order_card_item import OrderCardItem
from ..schemas.user_response_schema import UserUpdate
from ..helpers.department_helpers import is_vip_department
from datetime import datetime, timezone

async def patch_order_in_db(
    order_id: UUID,
    patch_data: OrderCardItem,
    db: Session,
    changed_by: str
):
    db.execute(
        text("SET session.audit.user_id = :user_id"),
        {"user_id": str(changed_by)}
    )

    order = db.query(Ride).filter(Ride.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="הנסיעה לא נמצאה")

    is_vip = is_vip_department(db, UUID(changed_by))

    if order.status == "approved" and not is_vip:
        raise HTTPException(
            status_code=400,
            detail="אי אפשר לערוך הזמנה שאושרה. ניתן רק לבטל ולהזמין חדשה."
        )

    # Save original status
    original_status = order.status

    data = patch_data.dict(exclude_unset=True)


    if "start_datetime" in data and data["start_datetime"]:
        now_utc = datetime.now(timezone.utc)

        incoming_start = data["start_datetime"]
        if incoming_start.tzinfo is None:
            incoming_start = incoming_start.replace(tzinfo=timezone.utc)

        if incoming_start < now_utc:
            duration = None

            if "end_datetime" in data and data["end_datetime"]:
                incoming_end = data["end_datetime"]
                if incoming_end.tzinfo is None:
                    incoming_end = incoming_end.replace(tzinfo=timezone.utc)

                duration = incoming_end - incoming_start

            data["start_datetime"] = now_utc

            if duration and duration.total_seconds() > 0:
                data["end_datetime"] = now_utc + duration


    for key, value in data.items():
        setattr(order, key, value)
        
    def _status_value(s):
        return s.value if hasattr(s, "value") else str(s)

    new_status = _status_value(order.status)
    old_status = _status_value(original_status)

    if "status" in data and new_status == "completed" and old_status != "completed":
        if order.vehicle_id:
            vehicle = db.query(Vehicle).filter(Vehicle.id == order.vehicle_id).first()

            if vehicle:
                distance_to_add = (
                    float(getattr(order, "actual_distance_km", 0) or 0)
                    or float(getattr(order, "estimated_distance_km", 0) or 0)
                )

                if distance_to_add < 0:
                    distance_to_add = 0

                vehicle.mileage = int(vehicle.mileage + distance_to_add)
                vehicle.mileage_last_updated = datetime.utcnow()

                vehicle.last_used_at = datetime.utcnow()
                vehicle.last_user_id = order.user_id

                if not getattr(order, "completion_date", None):
                    order.completion_date = datetime.utcnow()


    # VIP auto-approve
    if is_vip and order.status != RideStatus.approved:
        order.status = RideStatus.approved


    start = order.start_datetime
    end = order.end_datetime

    if start and end:
        ride_days = (end - start).days
        if ride_days >= 4:
            if not getattr(order, "extended_ride_reason", None):
                raise HTTPException(
                    status_code=400,
                    detail="יש לספק סיבה לנסיעה שעוברת 4 ימים"
                )

    vehicle = None
    if order.vehicle_id:
        vehicle = (
            db.query(Vehicle)
            .filter(Vehicle.id == order.vehicle_id)
            .first()
        )

    if vehicle and vehicle.type and vehicle.type.upper() == "4X4":
        if not getattr(order, "four_by_four_reason", None):
            raise HTTPException(
                status_code=400,
                detail="יש למלא סיבה לבחירת רכב 4X4"
            )

    db.commit()
    
    if "status" in data and new_status == "completed" and old_status != "completed":
        await sio.emit("vehicle_mileage_updated", {
            "vehicle_id": str(order.vehicle_id),
            "new_mileage": vehicle.mileage if vehicle else None
        })

    db.refresh(order)


    if (
        "status" in data
        and order.status != original_status
        and order.status.value in ["approved", "rejected"]
    ):
        employee = (
            db.query(User)
            .filter(User.employee_id == order.user_id)
            .first()
        )

        destination_city = (
            db.query(City)
            .filter(City.id == order.stop)
            .first()
        )

        destination_name = (
            destination_city.name
            if destination_city
            else order.stop
        )

        # EMAIL LOGIC — intentionally commented
        # (kept EXACTLY as you had it)

        # if employee_email:
        #     template_name = (
        #         "ride_approved.html"
        #         if order.status.value == "APPROVED"
        #         else "ride_rejected.html"
        #     )
        #
        #     html_content = load_email_template(
        #         template_name,
        #         {
        #             "EMPLOYEE_NAME": f"{employee.first_name} {employee.last_name}"
        #             if employee else "משתמש",
        #             "DESTINATION": destination_name,
        #             "DATE_TIME": str(order.start_datetime),
        #             "PLATE_NUMBER": order.plate_number or "לא נבחר",
        #             "DISTANCE": str(order.estimated_distance_km),
        #             "APPROVER_NAME": "המנהל שלך",
        #             "REJECTION_REASON": order.emergency_event or "לא צוין"
        #         }
        #     )
        #
        #     await async_send_email(
        #         to_email=employee_email,
        #         subject="✅ הנסיעה שלך אושרה"
        #         if order.status.value == "APPROVED"
        #         else "❌ הבקשה שלך נדחתה",
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

