# src/sockets/socket_manager.py
import socketio
from ..utils.auth import token_check_socket
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")

@sio.event
async def connect(sid, environ, auth=None):
    if not auth or "token" not in auth:
        print(f"❌ Connect failed: No auth or token for sid={sid}")
        return False  # disconnect unauthorized

    token = auth.get("token")
    if not token:
        print(f"❌ Connect failed: Token missing for sid={sid}")
        return False

    if not token_check_socket(token):
        print(f"❌ Connect failed: Token invalid for sid={sid}")
        return False

    print(f"✅ Socket connected: {sid}")


@sio.event
async def disconnect(sid):
    print(f"❌ Socket disconnected: {sid}")
