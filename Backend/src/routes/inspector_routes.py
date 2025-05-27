from fastapi import APIRouter
from pydantic import BaseModel
from uuid import UUID
from typing import Optional, List
from datetime import date


router = APIRouter()

@router.post("/")
def create_inspection(inspection: VehicleInspectionSchema):
    return {
        "message": "Inspection received",
        "data": inspection
    }

