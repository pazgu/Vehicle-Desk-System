from sqlalchemy.orm import Session
from ..models.user_model import User
from ..utils.auth import verify_password  # Import the verify_password function
from ..services.auth_service import create_access_token
from ..utils.mock_data import mock_users_db
from ..utils.mock_data import get_user_by_username
from fastapi import Depends, HTTPException
from ..utils.database import get_db  # a dependency that returns a db session

def login_user(username: str, password: str, db: Session = Depends(get_db)):
    # Try to fetch the user by username or email
    user = db.query(User).filter(
        (User.username == username) | (User.email == username)
    ).first()

    print(user)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password.")

    if not verify_password(password, user.password):
        raise HTTPException(status_code=401, detail="Incorrect username or password.")
    
    token = create_access_token(
        user_id=str(user.id),
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


# def login(db: Session, username: str, password: str):
#     user = db.query(User).filter(User.username == username).first()  # Look up the user by username
#     if user is None:
#         raise HTTPException(status_code=401, detail="Incorrect username or password.")
    
#     # Verify the password using the hashed password stored in the database
#     if not verify_password(password, user.password):
#         raise HTTPException(status_code=401, detail="Incorrect username or password.")
    
#     # If password is correct, generate the access token
#     access_token_data = create_access_token(
#         user_id=str(user.id),
#         username=user.username,
#         role=user.role
#     )

#     return { "access_token": access_token_data["token"], "expires_at": access_token_data["expires_at"] }