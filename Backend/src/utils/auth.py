from fastapi import Request, HTTPException, status,Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import List
from passlib.context import CryptContext
from dotenv import load_dotenv 
import jwt 
from jwt import PyJWTError
from os import environ

from .database import get_db
from ..models.user_model import User  
from ..models.department_model import Department

from ..services.auth_service import SECRET_KEY, ALGORITHM
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

load_dotenv()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = environ.get("JWT_SECRET")

ALGORITHM = environ.get("ALGORITHM")

# Function to hash a password
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

# Function to verify if the provided password matches the stored hashed password
def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        is_valid = pwd_context.verify(plain_password, hashed_password)
        return is_valid
    except Exception as e:
        return False



def token_check(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or Invalid token")
    
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def get_current_user(request: Request) -> User:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or Invalid token")

    token = auth_header[7:]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return User(
            employee_id=payload["sub"],
            username=payload["username"],
            first_name=payload["first_name"],
            last_name=payload["last_name"],
            role=payload["role"],
            department_id=payload.get("department_id")

        )
    except PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def token_check_socket(token: str) -> bool:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # You can add more checks on payload here if you want
        return True
    except PyJWTError:
        return False

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

        if not token_user_id:
            raise HTTPException(status_code=401, detail="Invalid token: Missing user_id")

        if token_user_id != user_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot access another user's orders"
            )

    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")



def supervisor_check(request: Request, department_id: int,db: Session = Depends(get_db)):
    token = request.headers.get("Authorization")
    if not token or not token.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or Invalid token")

    token = token.split(" ")[1]

    # ✅ Check role
    payload = role_check(["supervisor"], token)
    user_id = int(payload["sub"])
    # ✅ Extract supervised departments (from token or DB)
    supervised_departments = get_supervised_departments(user_id, db)

    if supervised_departments is None:
        raise HTTPException(status_code=403, detail="Supervision scope not found in token")

    if department_id not in supervised_departments:
        raise HTTPException(status_code=403, detail="Not authorized for this department")

    return payload  # or return supervisor info if needed




def get_supervised_departments(user_id: int, db: Session) -> list[int]:
    departments = (
        db.query(Department.id)
        .filter(Department.supervisor_id == user_id)
        .all()
    )
    return [dep.id for dep in departments]
