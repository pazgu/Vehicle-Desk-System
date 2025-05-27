from fastapi import FastAPI
from src.routes.user_routes import router as user_route
from src.routes.supervisor_routes import router as supervisor_route
from src.routes.admin_routes import router as admin_route
from src.routes.inspector_routes import router as inspector_route
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
app = FastAPI()

print("🚀 FastAPI app starting with CORS enabled")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],  # Allows the frontend from localhost:4200 to make requests
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods like GET, POST, PUT, DELETE, etc.
    allow_headers=["*"],  # Allows all headers
)

# Include user routes
app.include_router(user_route, tags=["Users"])
app.include_router(supervisor_route,prefix="/api",tags=["Supervisors"])
app.include_router(admin_route,prefix="/api",tags=["Admin"])
app.include_router(Inspector_route,prefix="/api",tags=["Inspector"])

@app.get("/")
def root():
    return {"message": "API is running"}


@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"➡️ Request: {request.method} {request.url}")
    response = await call_next(request)
    print(f"⬅️ Response: {response.status_code}")
    return response


