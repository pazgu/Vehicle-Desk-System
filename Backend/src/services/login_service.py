from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from ..models.user_model import User
from ..services.auth_service import create_access_token
from ..utils.auth import verify_password
from ..utils.database import get_db

def login_user(username: str, password: str, db: Session = Depends(get_db)):
    # Try to fetch the user by username or email
    user = db.query(User).filter(
        (User.username == username) | (User.email == username)
    ).first()

    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password.")

    if not verify_password(password, user.password):
        raise HTTPException(status_code=401, detail="Incorrect username or password.")
    
    token = create_access_token(
        user_id=str(user.employee_id),
        employee_id=str(user.employee_id),  # UUID as string
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        department_id=user.department_id     )

    return {
        **token,
        "token_type": "bearer",
        "department_id": str(user.department_id),  # UUID as string
    }
