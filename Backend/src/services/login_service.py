from sqlalchemy.orm import Session
from fastapi import HTTPException
from ..models.user_model import User
from ..utils.cyber import get_new_token

def login(db: Session, username: str, password: str):
    user = db.query(User).filter(User.username == username, User.password == password).first()
    if user is None:
        raise HTTPException(status_code = 401, detail = "Incorrect username or password.")
    token = get_new_token(user)
    return { "access_token": token }