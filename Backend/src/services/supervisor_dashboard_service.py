from typing import List
from datetime import datetime
from ..schemas.ride_dashboard_item import RideDashboardItem
from ..utils.mock_data import mock_orders, mock_users_db
from ..models.ride_model import Ride, RideStatus  # Import RideStatus
from ..models.user_model import User
from sqlalchemy.orm import Session

def get_department_orders(department_id: str, db: Session) -> List[RideDashboardItem]:
    """
    Fetch all orders for a specific department by joining the Ride and User tables.
    """
    # Query the database for rides where the user's department matches the given department_id
    orders = (
        db.query(Ride)
        .join(User, User.employee_id == Ride.user_id)
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
        vehicle_plate = f"Plate-{str(order.vehicle_id)[:8]}"  # Replace with actual logic if needed

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


def get_department_specific_order(department_id: str, order_id: str, db: Session) -> RideDashboardItem:
    order = db.query(Ride).filter(Ride.id == order_id).first()

    if not order:
        return None  # Or raise an exception if the order is not found

    # Query the users table to get the employee name
    user = db.query(User).filter(User.employee_id == order.user_id).first()
    employee_name = f"{user.first_name} {user.last_name}" if user else "Unknown"

    # Get the vehicle plate (mocked for now)
    vehicle_plate = f"Plate-{str(order.vehicle_id)[:8]}"  # Replace with actual logic if needed


    # Create a RideDashboardItem schema for the specific order
    order_details = RideDashboardItem(
        ride_id=str(order.id),  # Ensure ride_id is a string
        employee_name=employee_name,
        requested_vehicle_plate=vehicle_plate,
        date_and_time=order.start_datetime,
        destination=order.destination,
        distance=order.estimated_distance_km,
        status=order.status.value
    )

    return order_details