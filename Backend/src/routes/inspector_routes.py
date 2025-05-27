from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from src.utils.database import get_db
from src.schemas.check_vehicle_schema import VehicleInspectionSchema
from src.services.inspector_service import create_inspection
from src.utils.auth import get_current_user, role_check
from src.models.user_model import User

router = APIRouter()

@router.post("/vehicle-inspections")
def submit_inspection(
    data: VehicleInspectionSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    role_check(["inspector"], token=None)  # Assuming token already validated in get_current_user

    return create_inspection(data, db)
