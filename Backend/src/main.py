from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from socketio import ASGIApp
import socketio

from src.routes.user_routes import router as user_route
from src.routes.supervisor_routes import router as supervisor_route
from src.routes.admin_routes import router as admin_route 
from src.schemas.vehicle_create_schema import VehicleCreate
from src.routes.vehicle_routes import router as vehicle_route

from src.routes.inspector_routes import router as inspector_route
from fastapi import Request
from src.utils.scheduler import start_scheduler
from fastapi_socketio import SocketManager
from .utils.socket_manager import connect
import asyncio
from socketio import ASGIApp
from .utils.socket_manager import sio
import threading
from .utils.audit_log_listener import listen_for_audit_logs

from src.utils.scheduler import start_scheduler
from src.utils.socket_manager import sio  # your socketio.AsyncServer
from src.services.email_service import send_email


# ✅ Step 1–5: Create and configure the FastAPI app
app = FastAPI()
# Start the audit log listener in a background thread
threading.Thread(target=listen_for_audit_logs, daemon=True).start()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user_route, tags=["Users"])
app.include_router(supervisor_route, prefix="/api", tags=["Supervisors"])
app.include_router(admin_route, prefix="/api", tags=["Admin"])
app.include_router(inspector_route, prefix="/api", tags=["Inspector"])
app.include_router(vehicle_route, prefix="/api")

start_scheduler()

@app.get("/")
def root():
    return {"message": "API is running"}

@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"➡️ Request: {request.method} {request.url}")
    response = await call_next(request)
    print(f"⬅️ Response: {response.status_code}")
    return response

@sio.on("join")
async def handle_join(sid, data):
    user_id = data.get("user_id")
    if user_id:
        await sio.enter_room(sid, user_id)
        print(f"✅ User {user_id} joined room (SID: {sid})")
    else:
        print("⚠️ No user_id provided in join event.")


# app = FastAPI() is the base app used for routers and middleware
# sio_app wraps app with Socket.IO support — use this in uvicorn if you want sockets
# Run with: uvicorn src.main:sio_app --reload

# sio_app = ASGIApp(sio, other_asgi_app=app)
sio_app = socketio.ASGIApp(sio, other_asgi_app=app)


@app.get("/test-email")
def test_email():
    try:
        send_email(
            to_email="bookitkrm@gmail.com",  
            subject="בדיקת מייל מ-FastAPI",
            html_content="<h2>בדיקה</h2><p>זהו מייל בדיקה</p>",
            text_content="בדיקה פשוטה"
        )
        return {"message": "המייל נשלח בהצלחה"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="שליחת המייל נכשלה")