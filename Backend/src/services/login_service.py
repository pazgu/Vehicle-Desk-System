from sqlalchemy.orm import Session
from fastapi import HTTPException
from ..models.user_model import User
from ..utils.auth import verify_password  # Import the verify_password function
from ..services.auth_service import create_access_token
from ..utils.mock_data import mock_users_db
from ..utils.mock_data import get_user_by_username






def login_user(username: str, password: str):
    mock_user = get_user_by_username(username)
    
    if not mock_user or not verify_password(password, mock_user["password"]):
        raise HTTPException(status_code=401, detail="Incorrect username or password.")
    
    token = create_access_token(
    user_id=str(mock_user["id"]),
    username=mock_user["username"],
    role=mock_user["role"]
        )


    return {
        **token,  # spread fields directly into the response
    "token_type": "bearer"
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