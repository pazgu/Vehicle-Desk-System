from math import radians, sin, cos, sqrt, atan2
from sqlalchemy.orm import Session
from ..models.city_model import City , CityAlias

EARTH_RADIUS_KM = 6371.0

def normalize_city_name_to_id(city_name: str, db: Session) -> str:
    city = db.query(City).filter(City.name == city_name).first()
    if city:
        return city.id

    alias = db.query(CityAlias).filter(CityAlias.alias == city_name).first()
    if alias:
        return alias.city_id

    raise ValueError(f"Unknown city name: '{city_name}'")

def get_coordinates_by_city_id(city_id: str, db: Session):
    city = db.query(City).filter(City.id == city_id).first()
    if not city:
        raise ValueError(f"City with ID {city_id} not found")
    return float(city.latitude), float(city.longitude)

def calculate_distance(city_id1: str, city_id2: str, db: Session) -> float:
    # city_id1 = normalize_city_name_to_id(city_name1, db)
    # city_id2 = normalize_city_name_to_id(city_name2, db)
    lat1, lon1 = get_coordinates_by_city_id(city_id1, db)
    lat2, lon2 = get_coordinates_by_city_id(city_id2, db)

    # Haversine formula
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)

    a = sin(dlat / 2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    distance = EARTH_RADIUS_KM * c
    distance_with_buffer = distance * 1.10
    return round(distance_with_buffer, 2)

def get_cities(db: Session):
    return db.query(City).all()