from uuid import UUID
from pydantic import BaseModel


class RideRequirementConfirmationIn(BaseModel):
    ride_id: UUID
    confirmed: bool
