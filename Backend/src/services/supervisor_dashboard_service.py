import math
from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import String, func, text, desc
from sqlalchemy.orm import Session

# Utils
from ..utils.audit_utils import log_action

# Services
from .vehicle_service import update_vehicle_status

# Schemas
from ..schemas.check_vehicle_schema import VehicleInspectionSchema
from ..schemas.order_card_item import OrderCardItem
from ..schemas.ride_dashboard_item import RideDashboardItem

# Models
from ..models.notification_model import NotificationType, Notification
from ..models.ride_model import Ride, RideStatus
from ..models.user_model import User
from ..models.vehicle_inspection_model import VehicleInspection
from ..models.vehicle_model import VehicleStatus, Vehicle
  
  #helper function
# def get_user_email(user_id: UUID, db: Session) -> str | None:
#     """Fetches a user's email from the database by their ID."""
#     user = db.query(User).filter(User.employee_id == user_id).first()
#     if user and user.email:
#         return user.email
#     return None


from ..utils.socket_manager import sio
def get_department_orders(department_id: str, db: Session) -> List[RideDashboardItem]:
    """
    Fetch all orders for a specific department by joining the Ride and User tables.
    """
    # Query the database for rides where the user's department matches the given department_id
    orders = (
    db.query(Ride, Vehicle.vehicle_model)
    .join(User, User.employee_id == Ride.user_id)
    .join(Vehicle, Ride.vehicle_id == Vehicle.id)
    .filter(User.department_id == department_id)
    .order_by(desc(Ride.submitted_at))  # 👈 Sort by submitted_at DESC
    .all()
)


    # Map the database results to the RideDashboardItem schema
    dashboard_items = []

    for order, vehicle_model in orders:
        # Query the users table to get the employee name
        user = db.query(User).filter(User.employee_id == order.user_id).first()
        employee_name = f"{user.first_name} {user.last_name}" if user else "Unknown"

        # Get the vehicle plate (mocked for now)

        # Create a RideDashboardItem schema for each order
        dashboard_item = RideDashboardItem(
            ride_id=order.id,
            vehicle_id=order.vehicle_id,
            employee_name=employee_name,
            requested_vehicle_model=vehicle_model,
            date_and_time=order.start_datetime,
            end_datetime=order.end_datetime,
            destination=order.destination,
            distance = math.ceil(order.estimated_distance_km),
            status=order.status.value,  # Access the string value of the enum
            submitted_at=order.submitted_at 
        )

        dashboard_items.append(dashboard_item)

    return dashboard_items


def get_department_specific_order(department_id: str, order_id: str, db: Session) -> OrderCardItem:
    """
    Fetch the details of a specific order for a department.
    """
    # Query the database for the specific order
    order = (
        db.query(Ride)
        .join(User, User.employee_id == Ride.user_id)
        .filter(Ride.id == order_id, User.department_id == department_id)
        .first()
    )

    if not order:
        return None  # Or raise an exception if the order is not found

    # Create an OrderCardItem schema for the specific order
    order_details = OrderCardItem(
        id=order.id,  # Pass as UUID
        user_id=order.user_id,  # Pass as UUID
        vehicle_id=order.vehicle_id,  # Pass as UUID
        start_datetime=order.start_datetime,
        end_datetime=order.end_datetime,
        ride_type=order.ride_type.name if order.ride_type else None,  # Enum to string
        start_location=order.start_location,
        stop=order.stop or "",
        extra_stops=order.extra_stops or [],
        destination=order.destination,
        estimated_distance_km = float(math.ceil(order.estimated_distance_km)),
        actual_distance_km=float(order.actual_distance_km) if order.actual_distance_km else None,
        status=order.status,  # Pass as RideStatusEnum
        license_check_passed=order.license_check_passed,
        submitted_at=order.submitted_at,
        emergency_event=order.emergency_event,
    )

    return order_details


async def edit_order_status(department_id: str, order_id: str, new_status: str,user_id: UUID, db: Session, rejection_reason: str | None = None) -> bool:
    """
    Edit the status of a specific order for a department and sends a notification.
    """
    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user_id)})
    

    # Query the database for the specific order
    order = (
        db.query(Ride)
        .join(User, User.employee_id == Ride.user_id)
        .filter(Ride.id == order_id, User.department_id == department_id)
        .first()
    )

    if not order:
            raise HTTPException(status_code=404, detail="ההזמנה לא נמצאה")


    # Update the status of the order
    order.status = new_status
    if new_status.lower() == "rejected":
        order.rejection_reason = rejection_reason
    db.commit()

    hebrew_status_map = {
        "approved": "אושרה",
        "rejected": "נדחתה",
        "pending": "ממתינה"
    }
    message_he = f"ההזמנה שלך {hebrew_status_map.get(new_status.lower(), new_status)}"

    notification = Notification(
        user_id=order.user_id,
        notification_type=NotificationType.system,
        title="עדכון סטטוס הזמנה",
        message=message_he,
        sent_at=datetime.now(timezone.utc),
        order_id=order.id
    )

    db.add(notification)
    db.commit()
    db.refresh(notification)
    
     # Fetch extra details for email + Socket
    user = db.query(User).filter(User.employee_id == order.user_id).first()
    vehicle = db.query(Vehicle).filter(Vehicle.id == order.vehicle_id).first()


    # if user and vehicle:
    #     employee_email = get_user_email(order.user_id, db) # Use the helper function

    #     if employee_email:
    #         # Determine which template to use and the subject
    #         template_name = ""
    #         email_subject = ""
    #         if new_status.lower() == "approved":
    #             template_name = "ride_approved.html"
    #             email_subject = "✅ הנסיעה שלך אושרה"
    #         elif new_status.lower() == "rejected":
    #             template_name = "ride_rejected.html"
    #             email_subject = "❌ הבקשה שלך נדחתה"

    #         if template_name: # Only proceed if a valid template name was set
    #             template_context = {
    #                 "EMPLOYEE_NAME": f"{user.first_name} {user.last_name}",
    #                 "DESTINATION": order.destination,
    #                 "DATE_TIME": order.start_datetime.strftime("%Y-%m-%d %H:%M"),
    #                 "PLATE_NUMBER": vehicle.plate_number,
    #                 "DISTANCE": f"{order.estimated_distance_km} ק״מ",
    #                 "APPROVER_NAME": "המנהל שלך" # Keep this static for now, or fetch actual approver name
    #             }

    #             # Add rejection reason to context only if status is rejected
    #             if new_status.lower() == "rejected":
    #                 template_context["REJECTION_REASON"] = rejection_reason or "לא צוינה סיבה"
    #             else:
    #                 # Ensure REJECTION_REASON is cleared even if template for approved has it
    #                 template_context["REJECTION_REASON"] = ""

    #             # Load the email template and automatically replace placeholders using the context
    #             body = load_email_template(template_name, template_context)




    #             # Handle REJECTION_REASON for both approved and rejected emails
    #             if new_status.lower() == "rejected":
    #                 body = body.replace("{{REJECTION_REASON}}", rejection_reason or "לא צוינה סיבה")
    #             else:
    #                 body = body.replace("{{REJECTION_REASON}}", "")

    #             body = body.replace("{{APPROVER_NAME}}", "המנהל שלך")
    #             await async_send_email(
    #                 to_email = employee_email,
    #                 subject=email_subject,
    #                 html_content=body
    #             )

    # Always reset the audit session var
    db.execute(text("SET session.audit.user_id = DEFAULT"))

    await sio.emit("ride_status_updated", {
        "ride_id": str(order.id),
        "new_status": order.status
    })

    await sio.emit("new_notification", {
        "id": str(notification.id),
        "user_id": str(notification.user_id),
        "title": notification.title,
        "message": notification.message,
        "notification_type": notification.notification_type.value,
        "sent_at": notification.sent_at.isoformat(),
        "order_id": str(notification.order_id) if notification.order_id else None,
        "order_status": order.status
    })

    return order, notification
    



def get_department_notifications(department_id: UUID, db: Session) -> List[Notification]:
    # Find all supervisors in the department
    supervisors = db.query(User).filter(
        User.department_id == department_id,
        User.role == 'supervisor'  # adjust this if you use enums or constants
    ).all()

    supervisor_ids = [sup.employee_id for sup in supervisors]  # use employee_id here

    if not supervisor_ids:
        return []

    # Query notifications for those supervisors
    notifications = db.query(Notification).filter(
        Notification.user_id.in_(supervisor_ids)
    ).order_by(Notification.sent_at.desc()).all()

    return notifications


async def start_ride(db: Session, ride_id: UUID):
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    if ride.status != RideStatus.approved:
        raise HTTPException(status_code=400, detail="Ride must be approved before starting")

    vehicle = db.query(Vehicle).filter(Vehicle.id == ride.vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Assigned vehicle not found")

    if vehicle.status != VehicleStatus.available:
        raise HTTPException(status_code=400, detail="Vehicle is not available")


    # 1️⃣ Update vehicle status
    update_vehicle_status(
        vehicle_id=vehicle.id,
        new_status=VehicleStatus.in_use,
        freeze_reason=None,
        db=db,
        changed_by=ride.user_id
    )
    vehicle.last_used_at = func.now()

    # 2️⃣ Update ride status + pickup time
    ride.actual_pickup_time = datetime.now(timezone.utc)
    ride.status = RideStatus.in_progress

   

    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": f"{ride.user_id}"})

    db.commit()
    db.refresh(ride)
    db.refresh(vehicle)

    # 3️⃣ Emit ride update
    await sio.emit("ride_status_updated", {
        "ride_id": str(ride.id),
        "new_status": ride.status.value
    })
    # 4️⃣ Emit vehicle update
    await sio.emit("vehicle_status_updated", {
        "ride_id": str(vehicle.id),
        "new_status": vehicle.status.value
    })

    return ride,vehicle

def vehicle_inspection_logic(data: VehicleInspectionSchema, db: Session):

    inspection = VehicleInspection(
    inspection_id=data.inspection_id,
    inspected_by=data.inspected_by,
    inspection_date=datetime.now(timezone.utc),
    clean=data.clean,
    fuel_checked=data.fuel_checked,
    no_items_left=data.no_items_left,
    critical_issue_bool=data.critical_issue_bool,
    issues_found=data.issues_found,
    vehicle_id=data.vehicle_id,
)   

    db.add(inspection)

    db.commit()

    return {"message": "Ride completed and vehicle inspection recorded successfully"}

