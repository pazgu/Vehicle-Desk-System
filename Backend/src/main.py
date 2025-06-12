from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware as StarletteCORSMiddleware
from socketio import ASGIApp

from src.routes.user_routes import router as user_route
from src.routes.supervisor_routes import router as supervisor_route
from src.routes.admin_routes import router as admin_route
from src.routes.inspector_routes import router as inspector_route
from src.utils.database import get_db
from src.utils.scheduler import start_scheduler
from src.utils.socket_manager import sio

# Initialize FastAPI app
app = FastAPI()

# Wrap app with Socket.IO
sio_app = ASGIApp(sio, other_asgi_app=app)

# Enable CORS for frontend
app.add_middleware(
    StarletteCORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(user_route, tags=["Users"])
app.include_router(supervisor_route, prefix="/api", tags=["Supervisors"])
app.include_router(admin_route, prefix="/api", tags=["Admin"])
app.include_router(inspector_route, prefix="/api", tags=["Inspector"])

# Start background scheduler
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

# Final wrapped app with CORS for Socket.IO
from starlette.middleware.cors import CORSMiddleware

sio_app = CORSMiddleware(
    sio_app,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
