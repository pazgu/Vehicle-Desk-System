from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware as StarletteCORSMiddleware  # ← Use Starlette's!
from src.routes.user_routes import router as user_route
from src.routes.supervisor_routes import router as supervisor_route
from src.routes.admin_routes import router as admin_route
from src.routes.inspector_routes import router as inspector_route
from src.utils.scheduler import start_scheduler
from socketio import ASGIApp
from .utils.socket_manager import sio

# Step 1: Create FastAPI app
app = FastAPI()

# Step 2: Include routers BEFORE wrapping
app.include_router(user_route, tags=["Users"])
app.include_router(supervisor_route, prefix="/api", tags=["Supervisors"])
app.include_router(admin_route, prefix="/api", tags=["Admin"])
app.include_router(inspector_route, prefix="/api", tags=["Inspector"])

# Step 3: Start cron job scheduler
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
async def join_room(sid, data):
    room = data.get("room")
    if room:
        await sio.enter_room(sid, room)
        print(f"👥 Socket {sid} joined room {room}")

# Step 4: Wrap the FastAPI app with Socket.IO
socket_app = ASGIApp(sio, other_asgi_app=app)

# Step 5: Wrap the *final* app (socket_app) with CORS middleware
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware

sio_app = CORSMiddleware(
    socket_app,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
