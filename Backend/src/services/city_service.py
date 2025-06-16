from math import radians, sin, cos, sqrt, atan2
from sqlalchemy.orm import Session
from ..models.city_model import City , CityAlias

EARTH_RADIUS_KM = 6371.0


def get_city_coordinates(city_name: str, db: Session):
    city = db.query(City).filter(City.name == city_name).first()
    if city:
        return float(city.latitude), float(city.longitude)

    alias = db.query(CityAlias).filter(CityAlias.alias == city_name).first()
    if alias:
        city = db.query(City).filter(City.id == alias.city_id).first()
        if city:
            return float(city.latitude), float(city.longitude)

    raise ValueError(f"City '{city_name}' not found")


def calculate_distance(city1: str, city2: str, db: Session) -> float:
    lat1, lon1 = get_city_coordinates(city1 , db)
    lat2, lon2 = get_city_coordinates(city2 , db)

    # Haversine formula
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)

    a = sin(dlat / 2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    return round(EARTH_RADIUS_KM * c, 2)


def get_cities(db: Session):
    return db.query(City).all()