from enum import Enum
from pydantic import BaseModel

class RideStatusEnum(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"

class UpdateRideStatusRequest(BaseModel):
    status: RideStatusEnum
