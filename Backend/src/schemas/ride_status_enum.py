from enum import Enum
from pydantic import BaseModel

class RideStatusEnum(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"
    cancelled_due_to_no_show="cancelled_due_to_no_show"
    cancelled_vehicle_unavailable="cancelled_vehicle_unavailable"

class UpdateRideStatusRequest(BaseModel):
    status: RideStatusEnum
