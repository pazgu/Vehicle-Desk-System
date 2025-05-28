# socket_events.py
from fastapi_socketio import SocketManager

socket_manager: SocketManager = None  # set from main.py

def init_socket_events(manager: SocketManager):
    global socket_manager
    socket_manager = manager

    @manager.on("connect")
    async def connect(sid, *args, **kwargs):
        print(f"Socket connected: {sid}")

    @manager.on("disconnect")
    async def disconnect(sid, *args, **kwargs):
        print(f"Socket disconnected: {sid}")










