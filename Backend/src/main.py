from fastapi import FastAPI
from src.routes.user_routes import router as user_route  # Adjust path if needed

app = FastAPI()

# Include user routes
app.include_router(user_route, tags=["Users"])

@app.get("/")
def root():
    return {"message": "API is running"}
