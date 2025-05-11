from typing import List, Optional
from datetime import datetime, timedelta
from ..schemas.future_rides_schema import FutureRides, RideStatus

def get_future_rides_for_user(
    user_id: int,
    status: Optional[RideStatus] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None
) -> List[FutureRides]:

    now = datetime.utcnow()

    mock_data = [
        FutureRides(
            ride_id="2025-00034",
            vehicle="Nissan Leaf EV",
            start_datetime=now + timedelta(days=2),
            end_datetime=now + timedelta(days=2, hours=2),
            purpose="Client meeting",
            estimated_distance="45 km",
            status=RideStatus.approved
        ),
        FutureRides(
            ride_id="2025-00035",
            vehicle="Toyota Prius",
            start_datetime=now - timedelta(days=1),  # נסיעה שכבר קרתה
            end_datetime=now - timedelta(days=1, hours=-1.5),
            purpose="Old meeting",
            estimated_distance="30 km",
            status=RideStatus.completed
        )
    ]

    # סינון לפי תאריך עתידי בלבד
    future_rides = [ride for ride in mock_data if ride.start_datetime > now]

    if status:
        future_rides = [r for r in future_rides if r.status == status]

    if from_date:
        future_rides = [r for r in future_rides if r.start_datetime >= from_date]

    if to_date:
        future_rides = [r for r in future_rides if r.start_datetime <= to_date]

    # מיון לפי תאריך
    future_rides.sort(key=lambda r: r.start_datetime)

    return future_rides
