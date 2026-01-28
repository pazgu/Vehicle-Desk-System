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

    user_id = str(user_info.get('user_id'))
    department_id = str(user_info.get('department_id')) if user_info.get('department_id') else None
    role = user_info.get('role')

    await sio.save_session(sid, {
        'user_id': user_id,
        'role': role,
        'department_id': department_id
    })
    
    await sio.enter_room(sid, user_id)
    user_rooms[user_id] = sid

    if department_id and department_id != 'None':
        department_room = f"department_{department_id}"
        await sio.enter_room(sid, department_room)
    return True

@sio.event
async def join(sid, data):
    session = await sio.get_session(sid)
    if not session:
        return
    
    user_id = data.get('user_id')
    if user_id and str(user_id) == session.get('user_id'):
        await sio.enter_room(sid, str(user_id))
        user_rooms[str(user_id)] = sid

        department_id = session.get('department_id')
        if department_id and department_id != 'None':
            department_room = f"department_{department_id}"
            await sio.enter_room(sid, department_room)

@sio.event
async def disconnect(sid):
    session = await sio.get_session(sid)
    if session and 'user_id' in session:
        user_id = session['user_id']
        if str(user_id) in user_rooms and user_rooms[str(user_id)] == sid:
            del user_rooms[str(user_id)]
            return
        else:
            return


async def emit_new_ride_request(ride_data: dict):
    """Emit new ride request to department supervisors"""
    department_id = ride_data.get('department_id')
    if department_id:
        department_room = f"department_{department_id}"
        await sio.emit('new_ride_request', ride_data, room=department_room)

async def emit_order_updated(ride_id: str, ride_data: dict):
    """Emit order update to relevant department"""
    department_id = ride_data.get('department_id')
    if department_id:
        department_room = f"department_{department_id}"
        await sio.emit('order_updated', {
            'ride_id': ride_id, 
            **ride_data
        }, room=department_room)

async def emit_order_deleted(ride_id: str, department_id: str):
    """Emit order deletion to relevant department"""
    if department_id:
        department_room = f"department_{department_id}"
        await sio.emit('order_deleted', {
            'ride_id': ride_id
        }, room=department_room)

async def emit_ride_status_updated(ride_id: str, new_status: str, department_id: str):
    """Emit ride status update to relevant department"""
    if department_id:
        department_room = f"department_{department_id}"
        await sio.emit('ride_status_updated', {
            'ride_id': ride_id,
            'new_status': new_status
        }, room=department_room)