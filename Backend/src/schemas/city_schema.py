from pydantic import BaseModel
from uuid import UUID


class City(BaseModel):
    id: UUID
    name: str
    latitude: float
    longitude: float
