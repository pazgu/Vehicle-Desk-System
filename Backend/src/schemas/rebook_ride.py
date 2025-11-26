
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, List

from ..schemas.new_ride_schema import RideCreate

from ..models.ride_model import RideType

class RideRebookData(BaseModel):
    id:UUID
    user_id: UUID
    ride_type: RideType
    start_datetime: datetime
    end_datetime: datetime
    start_location: str
    stop: str
    destination: str
    estimated_distance: Optional[float] = None
    actual_distance_km: Optional[float] = None
    four_by_four_reason: Optional[str] = None
    extended_ride_reason: Optional[str] = None
    target_type: Optional[str] = "self"
    extra_stops: Optional[List[UUID]] = None
    is_extended_request: Optional[bool] = False

    class Config:
        from_attributes = True


class RebookRideRequest(BaseModel):
    old_ride_id: UUID
    new_ride: RideCreate   


class HasPendingRebookResponse(BaseModel):
    has_pending: bool