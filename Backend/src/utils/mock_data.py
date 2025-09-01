import uuid

mock_users_db = [{
        "id": "a1111111-1111-1111-1111-111111111111",
        "first_name": "John",
        "last_name": "Doe",
        "username": "johndoe",
        "email": "john.doe@example.com",
        "employee_id": "EMP123",
        "password": "hashed_password",  # Just a placeholder
        "role": "employee",
        "department_id": "d2222222-2222-2222-2222-222222222222"
    }]

mock_orders = [
    {
        "order_id": str(uuid.uuid4()),
        "department_id": "d2222222-2222-2222-2222-222222222222" ,  # Mock department_id
        "user_id": "a1111111-1111-1111-1111-111111111111",
        "ride_type": "administrative",
         "vehicle_id": str(uuid.uuid4()),
        "start_datetime": "2025-05-12T09:00:00",
        "end_datetime": "2025-05-12T15:00:00",
        "start_location": "Central HQ",
        "stop": "Checkpoint X",
        "destination": "Regional Office",
        "estimated_distance_km": 80.0,
        "actual_distance_km": None,
        "status": "Pending",
        "license_check_passed": True,
        "submitted_at": "2025-05-07T08:00:00",
        "emergency_event": None
    },
    {
    "order_id": str(uuid.uuid4()),
    "department_id": "d3333333-3333-3333-3333-333333333333",  # Mock department_id
    "user_id": "a2222222-2222-2222-2222-222222222222",
    "ride_type": "operational",
    "order_id": str(uuid.uuid4()),
    "start_datetime": "2025-05-14T09:00:00",
    "end_datetime": "2025-05-14T12:00:00",
    "start_location": "Branch Office",
    "stop": "Regional Office",
    "destination": "Central HQ",
    "estimated_distance_km": 60.0,
    "actual_distance_km": None,
    "status": "Approved",
    "license_check_passed": True,
    "submitted_at": "2025-05-08T08:00:00",
    "emergency_event": None
}
]


# mock_data.py

mock_departments = [
    {
        "id": "1b47b5c2-13b7-40fd-b4f7-5e2b4a80c267",
        "name": "Engineering"
    },
    {
        "id": "2c57c6d3-24c8-40fe-c5a8-6f3d5b91d378",
        "name": "HR"
    },
    {
        "id": "3e9c8e54-9d2f-4a7b-b2fc-4a1bb60c47f9",
        "name": "Finance"
    }
]



# Helper to get user by username
def get_user_by_username(username: str):
    return next((user for user in mock_users_db if user["username"] == username), None)

def get_orders_by_department(department_id: str):
    orders = [order for order in mock_orders if order["department_id"] == department_id]
    return orders