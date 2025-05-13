from datetime import datetime, timedelta
import jwt  
from jwt import ExpiredSignatureError, InvalidTokenError, DecodeError
from ..schemas.user_response_schema import UserResponse
from ..models.user_model import User
from uuid import UUID
from datetime import datetime, timedelta

SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60







def create_access_token(employee_id: UUID, username: str,first_name:str,last_name:str, role: str, expires_delta: timedelta = None):
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    payload = {
        "sub": employee_id,
        "username": username,
        "first_name":first_name,
        "last_name":last_name,
        "role": role,
        "exp": expire
    }
    encoded_jwt = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return {
        "access_token": encoded_jwt,
        "expires_at": expire.isoformat(),
        "employee_id": employee_id,
        "username": username,
        "first_name":first_name,
        "last_name":last_name,
        "role": role,
        "token_type": "bearer"
    }


# Validate token: 
def validate_token(token: str) -> bool:
    try: 
        if not token:
            return False
        jwt.decode(token, AppConfig.jwt_secret, algorithms=["HS256"])
        return True
    except (ExpiredSignatureError, InvalidTokenError, DecodeError):
        return False

# def create_access_token(data: dict, expires_delta: timedelta = None):
#     to_encode = data.copy()
#     expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
#     to_encode.update({"exp": expire})
#     encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
#     return encoded_jwt


# def get_new_token(user: UserResponse) -> dict:
#     expiry = datetime.datetime.utcnow() + datetime.timedelta(hours=3)
#     payload = {
#         "user": {
#             "user_id": str(user.id),
#             "username": user.username,
#             "role": user.role
#         },
#         "exp": expiry
#     }
#     token = jwt.encode(payload, AppConfig.jwt_secret, algorithm="HS256")
#     return {"token": token, "expires_at": expiry.isoformat()}

