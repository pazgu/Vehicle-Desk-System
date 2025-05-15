from passlib.context import CryptContext
import jwt 
from fastapi import Request, HTTPException, status,Depends
from jwt import PyJWTError
from ..models.user_model import User  
from ..services.auth_service import SECRET_KEY, ALGORITHM
from fastapi.security import OAuth2PasswordBearer
from typing import List


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


# Initialize password context for bcrypt hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Function to hash a password
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

# Function to verify if the provided password matches the stored hashed password
def verify_password(plain_password: str, hashed_password: str) -> bool:
    print(pwd_context.verify(plain_password, hashed_password))
    return pwd_context.verify(plain_password, hashed_password)



def get_current_user(request: Request) -> User:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid token")

    token = auth_header[7:]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return User(
            employee_id=payload["sub"],
            username=payload["username"],
            first_name=payload["first_name"],
            last_name=payload["last_name"],
            role=payload["role"],
        )
    except PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")



def role_check(allowed_roles: list, token: str):
    try:
        # Decode the token and get the payload
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Extract user role from the payload
        user_role = payload.get("role")
        if not user_role:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token: Missing role")
        
        # Check if the user's role matches the allowed roles
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have the necessary permissions to access this resource"
            )
        return payload  # You can return the entire payload if needed
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")



def identity_check(user_id: str, token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        token_user_id = payload.get("sub")

        print("🔎 Token user_id:", token_user_id)
        print("🔐 Path user_id:", user_id)

        if not token_user_id:
            raise HTTPException(status_code=401, detail="Invalid token: Missing user_id")

        if token_user_id != user_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot access another user's orders"
            )

    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
