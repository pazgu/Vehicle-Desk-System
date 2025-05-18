from enum import Enum
from pydantic import BaseModel

class RideStatusEnum(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"

class UpdateRideStatusRequest(BaseModel):
    status: RideStatusEnum
