# In service.py (Mock data)

mock_orders = [
    {
        "order_id": "uuid1",
        "department_id": 1 ,  # Mock department_id
        "user_id": "uuid_user1",
        "ride_type": "administrative",
        "vehicle_id": "uuid_vehicle1",
        "start_datetime": "2025-05-12T09:00:00",
        "end_datetime": "2025-05-12T15:00:00",
        "start_location": "Central HQ",
        "stop": "Checkpoint X",
        "destination": "Regional Office",
        "estimated_distance_km": 80.0,
        "actual_distance_km": None,
        "status": "pending",
        "license_check_passed": True,
        "submitted_at": "2025-05-07T08:00:00",
        "emergency_event": None
    },
    {
        "order_id": "uuid2",
        "department_id": "department1",  # Mock department_id
        "user_id": "uuid_user2",
        "ride_type": "operational",
        "vehicle_id": "uuid_vehicle2",
        "start_datetime": "2025-05-13T10:00:00",
        "end_datetime": "2025-05-13T14:00:00",
        "start_location": "Regional Office",
        "stop": "HQ",
        "destination": "Branch Office",
        "estimated_distance_km": 50.0,
        "actual_distance_km": None,
        "status": "approved",
        "license_check_passed": False,
        "submitted_at": "2025-05-07T09:00:00",
        "emergency_event": None
    }
]

# Service function
def get_department_orders(department_id: str):
    # Filter mock orders by department_id
    orders = [order for order in mock_orders if order["department_id"] == department_id]
    
    # Convert them into the schema format if necessary
    return [schemas.RideDashboardItem(**order) for order in orders]