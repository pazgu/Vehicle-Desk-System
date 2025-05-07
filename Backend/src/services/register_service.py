from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta
import uuid

from ..schemas.register_schema import UserCreate, UserRole
from ..services.auth_service import create_access_token

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT config (use secure values in production)
SECRET_KEY = "your_secret_key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Simulated database
mock_users_db = []

class UserAlreadyExistsException(Exception):
    pass

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def create_user(user_data: UserCreate):
    try:
        # Check if username/email/employee_id already exists
        for user in mock_users_db:
            if user['username'] == user_data.username:
                raise ValueError("Username already exists")
            if user['email'] == user_data.email:
                raise ValueError("Email already exists")
            if user['employee_id'] == user_data.employee_id:
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

        # Simulate saving to the database
        mock_users_db.append(new_user)
        print(f"New user created: {new_user}")  # Debugging line
        
        return new_user
    
    except Exception as e:
        print(f"Error creating user: {str(e)}")  # Debugging line
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


