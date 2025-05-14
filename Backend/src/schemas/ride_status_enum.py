from enum import Enum

class RideStatusEnum(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"

    