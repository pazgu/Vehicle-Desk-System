from typing import List
from datetime import datetime,timezone
from ..schemas.ride_dashboard_item import RideDashboardItem
from ..schemas.order_card_item import OrderCardItem
from ..models.ride_model import Ride , RideStatus
from ..models.user_model import User
from sqlalchemy.orm import Session
from ..models.notification_model import NotificationType, Notification
from ..models.vehicle_model import VehicleStatus , Vehicle
from fastapi import HTTPException
from .vehicle_service import update_vehicle_status
from ..models.vehicle_inspection_model import VehicleInspection 
from ..schemas.check_vehicle_schema import VehicleInspectionSchema
from sqlalchemy import String , func
from ..utils.audit_utils import log_action
def get_department_orders(department_id: str, db: Session) -> List[RideDashboardItem]:
    """
    Fetch all orders for a specific department by joining the Ride and User tables.
    """
    # Query the database for rides where the user's department matches the given department_id
    orders = (
        db.query(Ride, Vehicle.plate_number)
        .join(User, User.employee_id == Ride.user_id)
        .join(Vehicle, Ride.vehicle_id == Vehicle.id)
        .filter(User.department_id == department_id)
        .all()
    )


    # Map the database results to the RideDashboardItem schema
    dashboard_items = []

    for order in orders:
        # Query the users table to get the employee name
        user = db.query(User).filter(User.employee_id == order.user_id).first()
        employee_name = f"{user.first_name} {user.last_name}" if user else "Unknown"

        # Get the vehicle plate (mocked for now)
        vehicle_plate = order.plate_number # Replace with actual logic if needed

        # Create a RideDashboardItem schema for each order
        dashboard_item = RideDashboardItem(
            ride_id=order.id,
            employee_name=employee_name,
            requested_vehicle_plate=vehicle_plate,
            date_and_time=order.start_datetime,
            destination=order.destination,
            distance=order.estimated_distance_km,
            status=order.status.value  # Access the string value of the enum
        )

        dashboard_items.append(dashboard_item)

    return dashboard_items


from uuid import UUID

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
        destination=order.destination,
        estimated_distance_km=float(order.estimated_distance_km),
        actual_distance_km=float(order.actual_distance_km) if order.actual_distance_km else None,
        status=order.status,  # Pass as RideStatusEnum
        license_check_passed=order.license_check_passed,
        submitted_at=order.submitted_at,
        emergency_event=order.emergency_event,
    )

    return order_details


def edit_order_status(department_id: str, order_id: str, new_status: str, db: Session) -> bool:
    """
    Edit the status of a specific order for a department and sends a notf.
    """
    # Query the database for the specific order
    order = (
        db.query(Ride)
        .join(User, User.employee_id == Ride.user_id)
        .filter(Ride.id == order_id, User.department_id == department_id)
        .first()
    )

    if not order:
        return False  # Or raise an exception if the order is not found

    # Update the status of the order
    order.status = new_status
    db.commit()

    log_action(
        db=db,
        action="update_ride_status",
        entity_type="Ride",
        entity_id=str(order.id),
        change_data={"new_status": new_status},
        changed_by=order.override_user_id  # or another field if you track who approved
    )

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
        order_id=order.id  # <-- attach the order id here

    )

    db.add(notification)
    db.commit()

    return True

from typing import List
from sqlalchemy.orm import Session
from uuid import UUID
from src.models.notification_model import Notification
from src.models.user_model import User  # assuming you have this model with department info and role

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


def start_ride(db: Session, ride_id: UUID):
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

    # vehicle.status = VehicleStatus.in_use

    update_vehicle_status(vehicle.id, VehicleStatus.in_use, freeze_reason=None, db=db)
    vehicle.last_used_at = func.now()
    
    db.commit()


def vehicle_inspection_logic(data: VehicleInspectionSchema, db: Session):
    
    inspection = VehicleInspection(
        vehicle_id=data.vehicle_id,
        inspected_by=data.inspected_by,
        fuel_level=data.fuel_level,
        tires_ok=data.tires_ok,
        clean=data.clean,
        issues_found=data.issues_found,
        inspection_date=datetime.utcnow()
    )

    db.add(inspection)

    db.commit()

    return {"message": "Ride completed and vehicle inspection recorded successfully"}


