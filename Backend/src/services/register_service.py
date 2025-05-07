from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta
import uuid
from ..utils.auth import hash_password  # Import hash_password from utils/auth
from ..schemas.register_schema import UserCreate, UserRole
from ..services.auth_service import create_access_token
from ..utils.mock_data import mock_users_db

# Password hashing

class UserAlreadyExistsException(Exception):
    pass


def create_user(user_data: UserCreate):
    for user in mock_users_db:
        if user["username"] == user_data.username:
            raise ValueError("Username already exists")
        if user["email"] == user_data.email:
            raise ValueError("Email already exists")
        if user["employee_id"] == user_data.employee_id:
            raise ValueError("Employee ID already exists")

    new_user = {
        "id": uuid.uuid4(),
        "first_name": user_data.first_name,
        "last_name": user_data.last_name,
        "username": user_data.username,
        "email": user_data.email,
        "employee_id": user_data.employee_id,
        "password": hash_password(user_data.password),
        "role": user_data.role,
        "department_id": user_data.department_id
    }

    mock_users_db.append(new_user)

    token_data = create_access_token(
        user_id=str(new_user["id"]),
        username=new_user["username"],
        role=new_user["role"]
    )

    return {
        "user_id": new_user["id"],
        **token_data
    }