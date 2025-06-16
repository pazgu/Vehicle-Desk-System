from sqlalchemy import Column, String, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from ..utils.database import Base

class City(Base):
    __tablename__ = "cities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)
    latitude = Column(Numeric(9, 6), nullable=False)
    longitude = Column(Numeric(9, 6), nullable=False)

    aliases = relationship("CityAlias", back_populates="city", cascade="all, delete")

class CityAlias(Base):
    __tablename__ = "city_aliases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    city_id = Column(UUID(as_uuid=True), ForeignKey("cities.id", ondelete="CASCADE"), nullable=False)
    alias = Column(String(100), nullable=False)

    city = relationship("City", back_populates="aliases")

    __table_args__ = (
        # This ensures (city_id, alias) is unique
        {'sqlite_autoincrement': True},
    )
