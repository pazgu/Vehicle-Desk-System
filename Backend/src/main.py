from fastapi import FastAPI
from src.routes.user_routes import router as user_route
from src.routes.supervisor_routes import router as supervisor_route


app = FastAPI()

# Include user routes
app.include_router(user_route, tags=["Users"])
app.include_router(supervisor_route,prefix="/api",tags=["Supervisors"])

@app.get("/")
def root():
    return {"message": "API is running"}

