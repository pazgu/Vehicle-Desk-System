from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from src.utils.database import get_db
from src.schemas.check_vehicle_schema import VehicleInspectionSchema
from src.services.inspector_service import create_inspection
from src.utils.auth import get_current_user, role_check
from src.models.user_model import User

router = APIRouter()

@router.post("/vehicle-inspections")
def submit_inspection(
    request: Request,
    data: VehicleInspectionSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submit a new vehicle inspection.
    Only accessible by users with the 'inspector' role.
    """
    token = request.headers.get("Authorization")
    if not token or not token.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")

    token = token.split(" ")[1]
    role_check(["inspector"], token)

    return create_inspection(data, db)