from pydantic import BaseModel
from typing import List
from schemas.ride_dashboard_item import RideDashboardItem

class SupervisorDashboardResponse(BaseModel):
    rides: List[RideDashboardItem]