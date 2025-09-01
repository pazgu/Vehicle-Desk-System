import socketio
from ..utils.auth import token_check_socket

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")

@sio.event
async def connect(sid, environ, auth=None):
    if not auth or "token" not in auth:
        return False  # disconnect unauthorized

    token = auth.get("token")
    if not token:
        return False

    if not token_check_socket(token):
        return False



@sio.event
async def disconnect(sid):
    print(f"❌ Socket disconnected")
