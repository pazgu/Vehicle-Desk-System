import jwt
from jwt import ExpiredSignatureError, InvalidTokenError
import datetime
from ..schemas.user_response_schema import UserResponse
from ..models.user_model import User
from ..utils.app_config import AppConfig

#Genrating new token:
def get_new_token(user: UserResponse) -> dict:
    expiry = datetime.datetime.utcnow() + datetime.timedelta(hours=3)
    payload = {
        "user": {
            "user_id": str(user.id),
            "username": user.username,
            "role": user.role
        },
        "exp": expiry
    }
    token = jwt.encode(payload, AppConfig.jwt_secret, algorithm="HS256")
    return {"token": token, "expires_at": expiry.isoformat()}



# Validate token: 
def validate_token(token: str) -> bool:
    try: 
        if not token:
            return False
        jwt.decode(token, AppConfig.jwt_secret, algorithms=["HS256"])
        return True
    except (ExpiredSignatureError, InvalidTokenError):
        return False