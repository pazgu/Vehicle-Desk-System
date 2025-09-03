import asyncio
import logging
import threading
from typing import Annotated

import socketio
from fastapi import Depends, FastAPI, HTTPException, Request, logger
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from socketio import ASGIApp

# Utils
from .utils.audit_log_listener import listen_for_audit_logs
from .utils.socket_manager import connect, sio
from src.utils.scheduler import start_scheduler

# Services
from src.services.email_clean_service import EmailService

# Schemas
from src.schemas.vehicle_create_schema import VehicleCreate

# Routes
from src.routes.admin_routes import router as admin_route
from src.routes.email_router import router as email_router
from src.routes.inspector_routes import router as inspector_route
from src.routes.supervisor_routes import router as supervisor_route
from src.routes.user_routes import router as user_route
from src.routes.vehicle_routes import router as vehicle_route

logger = logging.getLogger(__name__) 


app = FastAPI()
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

