import socketio
from ..utils.auth import token_check_socket

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
user_rooms = {}

@sio.event
async def connect(sid, environ, auth=None):
    if not auth or "token" not in auth:
        return False

    token = auth.get("token")
    if not token:
        return False

    user_info = token_check_socket(token)
    if not user_info:
        return False

    await sio.save_session(sid, {'user_id': str(user_info.get('user_id'))})
    print(f"User {user_info.get('user_id')} connected with sid {sid}")
    return True

@sio.event
async def join(sid, data):
    """Join user to their room"""
    session = await sio.get_session(sid)
    if not session:
        return
    
    user_id = data.get('user_id')
    if user_id and str(user_id) == session.get('user_id'):
        await sio.enter_room(sid, str(user_id))
        user_rooms[str(user_id)] = sid
        print(f"User {user_id} joined room")

@sio.event
async def disconnect(sid):
    session = await sio.get_session(sid)
    if session and 'user_id' in session:
        user_id = session['user_id']
        if str(user_id) in user_rooms:
            del user_rooms[str(user_id)]
    print(f"Socket disconnected: {sid}")
