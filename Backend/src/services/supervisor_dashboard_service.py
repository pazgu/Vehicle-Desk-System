from typing import List
from datetime import datetime
from ..schemas.ride_dashboard_item import RideDashboardItem
from ..utils.mock_data import mock_orders, mock_users_db
from ..models.ride_model import Ride

def get_department_orders(department_id: str) -> List[RideDashboardItem]:
    # Get orders by department
    orders = [order for order in mock_orders if order["department_id"] == department_id]
    
    # Now let's map these orders to the RideDashboardItem schema
    dashboard_items = []
    
    for order in orders:
        # Get the employee name from the users mock data
        user = next((user for user in mock_users_db if user["id"] == order["user_id"]), None)
        employee_name = f"{user['first_name']} {user['last_name']}" if user else "Unknown"
        
        # Get the vehicle plate (mocked for now)
        vehicle_plate = f"Plate-{order['vehicle_id'][:8]}"  # Just a mock, adjust as needed
        
        # Create a RideDashboardItem schema for each order, extracting only necessary fields
        dashboard_item = RideDashboardItem(
            ride_id=order["order_id"],  # Map 'order_id' directly to 'ride_id'
            employee_name=employee_name,
            requested_vehicle_plate=vehicle_plate,
            date_and_time=datetime.fromisoformat(order["start_datetime"]),
            distance=order["estimated_distance_km"],
            status=order["status"]
        )
        
        dashboard_items.append(dashboard_item)

    return dashboard_items


def get_department_specific_order(department_id: str, order_id: str) -> RideDashboardItem:
    # Get a specific order by department and order ID
    order = next((order for order in mock_orders if order["department_id"] == department_id and order["order_id"] == order_id), None)
    
    if not order:
        return None  # Or raise an exception
    
    # Get the employee name from the users mock data
    user = next((user for user in mock_users_db if user["id"] == order["user_id"]), None)
    
    # Get the vehicle plate (mocked for now)
    vehicle_plate = f"Plate-{order['vehicle_id'][:8]}"  # Just a mock, adjust as needed
    
    # Create a RideDashboardItem schema for the specific order
    order_details = RideDashboardItem(
        ride_id=order["order_id"],  # Map 'order_id' directly to 'ride_id'
        employee_id=order["user_id"],
        requested_vehicle_plate=vehicle_plate,
        estimated_ride_type=order["ride_type"],
        start_datetime=datetime.fromisoformat(order["start_datetime"]),
        end_datetime=datetime.fromisoformat(order["end_datetime"]),
        start_location=order["start_location"],
        stop=order["stop"],
        destination=order["destination"],
        estimated_distance=order["estimated_distance_km"],
        actual_distance=order.get("actual_distance_km", 0),  # Default to 0 if not present
        license_check_passed=order["license_check_passed"],
        submitted_at=datetime.fromisoformat(order["submitted_at"]),
        status=order["status"]
    )
    
    return order_details