from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from src.models.ride_model import Ride, RideStatus
from src.models.no_show_event_model import NoShowEvent
from src.models.audit_log_model import AuditLog
from src.models.vehicle_model import Vehicle, VehicleStatus  # ה־Enum שלך
import uuid

def auto_cancel_no_show_rides(db: Session):
    now = datetime.now(timezone.utc)
    cutoff_time = now - timedelta(hours=2)

    # שליפה של נסיעות שעומדות בקריטריונים
    rides_to_cancel = db.query(Ride).filter(
        Ride.status.in_([RideStatus.approved, RideStatus.pending]),  # שימי לב לסטטוסים הנכונים
        Ride.start_datetime < cutoff_time,
        Ride.actual_pickup_time == None  # עדיין לא עלה בפועל
    ).all()

    for ride in rides_to_cancel:
        # עדכון סטטוס הנסיעה לביטול עקב אי-הגעה
        ride.status = RideStatus.cancelled_due_to_no_show

        # יצירת אירוע NoShow
        passenger_id = ride.override_user_id or ride.user_id
        no_show_event = NoShowEvent(
            user_id=passenger_id,
            ride_id=ride.id
        )
        db.add(no_show_event)

        # עדכון סטטוס הרכב ל-available באמצעות Enum
        vehicle = db.query(Vehicle).filter(Vehicle.id == ride.vehicle_id).first()
        if vehicle:
            vehicle.status = VehicleStatus.available

        # יצירת רישום AuditLog (הנחה שיש לך מודל כזה)
        audit_log = AuditLog(
            action="auto_cancel_no_show",
            entity_type="ride",
            entity_id=str(ride.id),
            change_data={"reason": "not picked up within 2 hours"},
            created_at=now,
            changed_by=passenger_id,
            notes="Auto-cancelled due to no-show"
        )
        db.add(audit_log)

    db.commit()
