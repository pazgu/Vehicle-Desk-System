from typing import List, Optional
from datetime import datetime, timedelta
from ..schemas.user_rides_schema import RideSchema, RideStatusEnum, FuelType

def get_all_mock_rides() -> List[RideSchema]:
    now = datetime.utcnow()

    return [
        RideSchema(
            ride_id="2025-00034",
            vehicle=FuelType.hybrid,
            start_datetime=now + timedelta(days=2),
            end_datetime=now + timedelta(days=2, hours=2),
            estimated_distance="45 km",
            status=RideStatusEnum.approved
        ),
        RideSchema(
            ride_id="2025-00035",
            vehicle=FuelType.electric,
            start_datetime=now - timedelta(days=1),
            end_datetime=now - timedelta(days=1, hours=-1.5),
            estimated_distance="30 km",
            status=RideStatusEnum.pending
        )
    ]

def filter_rides(
    rides: List[RideSchema],
    status: Optional[RideStatusEnum] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None
) -> List[RideSchema]:
    if status:
        rides = [r for r in rides if r.status == status]
    if from_date:
        rides = [r for r in rides if r.start_datetime >= from_date]
    if to_date:
        rides = [r for r in rides if r.start_datetime <= to_date]
    rides.sort(key=lambda r: r.start_datetime)
    status_order = {"approved": 1, "pending": 2, "rejected": 3}
    rides.sort(key=lambda r: (status_order.get(r.status.value, 4), r.start_datetime))
    return rides

def get_future_rides(user_id: int, status=None, from_date=None, to_date=None):
    now = datetime.utcnow()
    all_rides = get_all_mock_rides()
    future = [r for r in all_rides if r.start_datetime > now]
    return filter_rides(future, status, from_date, to_date)

def get_past_rides(user_id: int, status=None, from_date=None, to_date=None):
    now = datetime.utcnow()
    all_rides = get_all_mock_rides()
    past = [r for r in all_rides if r.start_datetime <= now]
    return filter_rides(past, status, from_date, to_date)

def get_all_rides(user_id: int, status=None, from_date=None, to_date=None):
    all_rides = get_all_mock_rides()
    return filter_rides(all_rides, status, from_date, to_date)
