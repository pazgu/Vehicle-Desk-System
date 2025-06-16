# from fastapi import FastAPI
# from src.routes.user_routes import router as user_route
# from src.routes.supervisor_routes import router as supervisor_route
# from src.routes.admin_routes import router as admin_route
# from src.routes.inspector_routes import router as inspector_route
# from fastapi.middleware.cors import CORSMiddleware
# from fastapi import Request
# from src.utils.scheduler import start_scheduler
# from fastapi_socketio import SocketManager
# from .utils.socket_manager import connect
# import asyncio
# from socketio import ASGIApp
# from .utils.socket_manager import sio


# app = FastAPI()

# sio_app = ASGIApp(sio, other_asgi_app=app)

# print("🚀 FastAPI app starting with CORS enabled")


# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["http://localhost:4200"],  # Allows the frontend from localhost:4200 to make requests
#     allow_credentials=True,
#     allow_methods=["*"],  # Allows all methods like GET, POST, PUT, DELETE, etc.
#     allow_headers=["*"],  # Allows all headers
# )

# # Include user routes
# app.include_router(user_route, tags=["Users"])
# app.include_router(supervisor_route,prefix="/api",tags=["Supervisors"])
# app.include_router(admin_route,prefix="/api",tags=["Admin"])
# app.include_router(inspector_route,prefix="/api",tags=["Inspector"])

# start_scheduler()


# @app.get("/")
# def root():
#     return {"message": "API is running"}


# @app.middleware("http")
# async def log_requests(request: Request, call_next):
#     print(f"➡️ Request: {request.method} {request.url}")
#     response = await call_next(request)
#     print(f"⬅️ Response: {response.status_code}")
#     return response


# @sio.on("join")
# async def join_room(sid, data):
#     room = data.get("room")
#     if room:
#         await sio.enter_room(sid, room)
#         print(f"👥 Socket {sid} joined room {room}")


# # # from fastapi import FastAPI, Request
# # # from fastapi.middleware.cors import CORSMiddleware
# # # from src.routes.user_routes import router as user_route
# # # from src.routes.supervisor_routes import router as supervisor_route
# # # from src.routes.admin_routes import router as admin_route
# # # from src.routes.inspector_routes import router as inspector_route
# # # from src.utils.scheduler import start_scheduler
# # # from src.utils.socket_manager import sio  # this is your socketio.AsyncServer
# # # from socketio import ASGIApp

# # # # Step 1: Create FastAPI app
# # # app = FastAPI()

# # # # Step 2: Middleware
# # # app.add_middleware(
# # #     CORSMiddleware,
# # #     allow_origins=["http://localhost:4200"],
# # #     allow_credentials=True,
# # #     allow_methods=["*"],
# # #     allow_headers=["*"],
# # # )

# # # # Step 3: Include your routers
# # # app.include_router(user_route, tags=["Users"])
# # # app.include_router(supervisor_route, prefix="/api", tags=["Supervisors"])
# # # app.include_router(admin_route, prefix="/api", tags=["Admin"])
# # # app.include_router(inspector_route, prefix="/api", tags=["Inspector"])

# # # # Step 4: Start background scheduler
# # # start_scheduler()

# # # # ✅ Step 4.5: Optional route + request logger
# # # @app.get("/")
# # # def root():
# # #     return {"message": "API is running"}

# # # # Step 5: Add logging middleware (optional but useful)
# # # @app.middleware("http")
# # # async def log_requests(request: Request, call_next):
# # #     print(f"➡️ Request: {request.method} {request.url}")
# # #     response = await call_next(request)
# # #     print(f"⬅️ Response: {response.status_code}")
# # #     return response

# # # return app

# # # # ✅ Step 6: Mount FastAPI into Socket.IO ASGI app
# # # fastapi_app = create_app()
# # # sio_app = ASGIApp(sio, other_asgi_app=fastapi_app)

# # # # # Step 6: Wrap FastAPI with Socket.IO
# # # # sio_app = ASGIApp(sio, other_asgi_app=app)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from socketio import ASGIApp

from src.routes.user_routes import router as user_route
from src.routes.supervisor_routes import router as supervisor_route
from src.routes.admin_routes import router as admin_route
from src.routes.inspector_routes import router as inspector_route

from src.utils.scheduler import start_scheduler
from src.utils.socket_manager import sio  # your socketio.AsyncServer

# ✅ Step 1–5: Create and configure the FastAPI app
app = FastAPI()

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

# ✅ Step 6: Wrap with Socket.IO
sio_app = ASGIApp(sio, other_asgi_app=app)