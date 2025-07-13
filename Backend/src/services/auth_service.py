from datetime import datetime, timedelta
import jwt  
from jwt import ExpiredSignatureError, InvalidTokenError, DecodeError
from ..schemas.user_response_schema import UserResponse
from ..models.user_model import User
from uuid import UUID
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv 

from os import environ
load_dotenv()
SECRET_KEY = environ.get("JWT_SECRET", "hellogirl")
ACCESS_TOKEN_EXPIRE_MINUTES = int(environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
RESET_TOKEN_EXPIRE_MINUTES = int(environ.get("RESET_TOKEN_EXPIRE_MINUTES", "30"))
ALGORITHM = environ.get("ALGORITHM", "HS256")




def create_access_token(user_id: UUID,
                        employee_id: UUID, 
                        username: str,
                        first_name:str,
                        last_name:str, 
                        role: str,
                        department_id: Optional[UUID] = None, 
                        has_government_license: bool = False,
                        expires_delta: timedelta = None):
                        
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=int(ACCESS_TOKEN_EXPIRE_MINUTES)))

    payload = {
        "sub": str(employee_id),
        "user_id": str(user_id),  
        "username": username,
        "first_name":first_name,
        "last_name":last_name,
        "role": role,
        "department_id": str(department_id) if department_id else None,
        "has_government_license": has_government_license,
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
        "department_id": department_id,
        "has_government_license": False,
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




def create_reset_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=int(RESET_TOKEN_EXPIRE_MINUTES))
    payload = {
        "sub": user_id,
        "exp": expire
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_reset_token(token: str) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload["sub"]
    except ExpiredSignatureError:
        raise ValueError("Reset token has expired")
    except InvalidTokenError:
        raise ValueError("Invalid reset token")


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

