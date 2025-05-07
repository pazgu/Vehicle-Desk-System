# mock_db.py
import uuid

# Shared mock database
mock_users_db = []

# Helper to get user by username
def get_user_by_username(username: str):
    return next((user for user in mock_users_db if user["username"] == username), None)
