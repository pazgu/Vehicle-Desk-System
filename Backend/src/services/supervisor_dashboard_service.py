import math
from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import String, func, or_, text, desc
from sqlalchemy.orm import Session

from ..models.department_model import Department

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

from ..utils.socket_manager import sio

def get_department_orders(department_id: str, db: Session, current_user: User) -> List[RideDashboardItem]:

    department = db.query(Department).filter(Department.id == department_id).first()
    official_supervisor_id = department.supervisor_id if department else None

    is_official = (str(current_user.employee_id) == str(official_supervisor_id))

    query = (
        db.query(Ride, Vehicle.vehicle_model)
        .join(User, User.employee_id == Ride.user_id)
        .join(Vehicle, Ride.vehicle_id == Vehicle.id)
        .filter(User.department_id == department_id)
        .filter(User.role == "employee")
    )

    # Filter based on supervisor assignment
    if is_official:
        query = query.filter(
            or_(
                Ride.approving_supervisor == None,
                Ride.approving_supervisor == current_user.employee_id
            )
        )
    else:
        query = query.filter(Ride.approving_supervisor == current_user.employee_id)

    orders = query.order_by(
        # Sort in_progress to the top
        (Ride.status != RideStatus.in_progress),
        desc(Ride.submitted_at)
    ).all()

    dashboard_items = []
    for order, vehicle_model in orders:
        user = db.query(User).filter(User.employee_id == order.user_id).first()
        employee_name = f"{user.first_name} {user.last_name}" if user else "Unknown"

        dashboard_item = RideDashboardItem(
            ride_id=order.id,
            vehicle_id=order.vehicle_id,
            employee_name=employee_name,
            requested_vehicle_model=vehicle_model,
            date_and_time=order.start_datetime,
            end_datetime=order.end_datetime,
            destination=order.destination,
            distance=math.ceil(order.estimated_distance_km),
            status=order.status.value,
            submitted_at=order.submitted_at,
        )
        dashboard_items.append(dashboard_item)

    return dashboard_items


def get_department_specific_order(department_id: str, order_id: str, db: Session) -> OrderCardItem:
    """
    Fetch the details of a specific order for a department.
    """
    order = (
        db.query(Ride)
        .join(User, User.employee_id == Ride.user_id)
        .filter(Ride.id == order_id, User.department_id == department_id)
        .first()
    )

    if not order:
        return None  

    order_details = OrderCardItem(
        id=order.id, 
        user_id=order.user_id,  
        vehicle_id=order.vehicle_id,  
        start_datetime=order.start_datetime,
        end_datetime=order.end_datetime,
        ride_type=order.ride_type.name if order.ride_type else None,
        start_location=order.start_location,
        stop=order.stop or "",
        extra_stops=order.extra_stops or [],
        destination=order.destination,
        estimated_distance_km = float(math.ceil(order.estimated_distance_km)),
        actual_distance_km=float(order.actual_distance_km) if order.actual_distance_km else None,
        status=order.status,  
        license_check_passed=order.license_check_passed,
        submitted_at=order.submitted_at,
        emergency_event=order.emergency_event,
        four_by_four_reason=order.four_by_four_reason,
        extended_ride_reason=order.extended_ride_reason,
    )

    return order_details


async def edit_order_status(department_id: str, order_id: str, new_status: str,user_id: UUID, db: Session, rejection_reason: str | None = None) -> bool:
    """
    Edit the status of a specific order for a department and sends a notification.
    """
    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user_id)})
    
    order = (
        db.query(Ride)
        .join(User, User.employee_id == Ride.user_id)
        .filter(Ride.id == order_id, User.department_id == department_id)
        .first()
    )

    if not order:
        raise HTTPException(status_code=404, detail="ההזמנה לא נמצאה")

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

    user = db.query(User).filter(User.employee_id == order.user_id).first()
    vehicle = db.query(Vehicle).filter(Vehicle.id == order.vehicle_id).first()

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
        "order_status": order.status,
        "Seen": False
    })

    return order, notification


def get_department_notifications(department_id: UUID, db: Session) -> List[Notification]:
    supervisors = db.query(User).filter(
        User.department_id == department_id,
        User.role == 'supervisor'
    ).all()

    supervisor_ids = [sup.employee_id for sup in supervisors]

    if not supervisor_ids:
        return []
    
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

    update_vehicle_status(
        vehicle_id=vehicle.id,
        new_status=VehicleStatus.in_use,
        freeze_reason=None,
        db=db,
        changed_by=ride.user_id
    )
    vehicle.last_used_at = func.now()

    ride.actual_pickup_time = datetime.now(timezone.utc)
    ride.status = RideStatus.in_progress

    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": f"{ride.user_id}"})

    db.commit()
    db.refresh(ride)
    db.refresh(vehicle)

    await sio.emit("ride_status_updated", {
        "ride_id": str(ride.id),
        "new_status": ride.status.value
    })

    await sio.emit("vehicle_status_updated", {
        "ride_id": str(vehicle.id),
        "new_status": vehicle.status.value
    })

    return ride, vehicle


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
