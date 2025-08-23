from typing import Annotated
from fastapi import Depends, FastAPI, HTTPException, Request, logger
import logging
from fastapi.middleware.cors import CORSMiddleware
from socketio import ASGIApp
import socketio
from fastapi.staticfiles import StaticFiles

from src.services.email_clean_service import EmailService
from src.routes.user_routes import router as user_route
from src.routes.supervisor_routes import router as supervisor_route
from src.routes.admin_routes import router as admin_route 
from src.schemas.vehicle_create_schema import VehicleCreate
from src.routes.vehicle_routes import router as vehicle_route
from src.routes.email_router import router as email_router

from src.routes.inspector_routes import router as inspector_route
from fastapi import Request
from .utils.socket_manager import connect
import asyncio
from socketio import ASGIApp
from .utils.socket_manager import sio
import threading
from .utils.audit_log_listener import listen_for_audit_logs

from src.utils.scheduler import start_scheduler
from src.utils.socket_manager import sio  # your socketio.AsyncServer

logger = logging.getLogger(__name__) 


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
app.include_router(email_router, prefix="/api", tags=["Emails"])
start_scheduler()

@app.get("/")
def root():
    return {"message": "API is running"}

@app.middleware("http")
async def log_requests(request: Request, call_next):
    response = await call_next(request)
    return response

@sio.on("join")
async def handle_join(sid, data):
    user_id = data.get("user_id")
    if user_id:
        await sio.enter_room(sid, user_id)



app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

sio_app = socketio.ASGIApp(sio, other_asgi_app=app)

