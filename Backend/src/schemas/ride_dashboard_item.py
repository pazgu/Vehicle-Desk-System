from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from schemas.ride_status_enum import RideStatusEnum

class RideDashboardItem(BaseModel):
    ride_id: int
    employee_name: str
    requested_vehicle_plate: str
    date_and_time: datetime
    distance: float
    status: RideStatusEnum

    