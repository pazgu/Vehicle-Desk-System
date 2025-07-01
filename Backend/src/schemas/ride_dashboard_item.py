from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from .ride_status_enum import RideStatusEnum  # Relative import
from uuid import UUID



class RideDashboardItem(BaseModel):
    ride_id: UUID
    employee_name: str
    requested_vehicle_plate: str
    vehicle_id: UUID
    date_and_time: datetime
    distance: float
    status: RideStatusEnum
    submitted_at: datetime 


    

    