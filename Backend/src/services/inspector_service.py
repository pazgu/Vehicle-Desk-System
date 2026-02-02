from ..models.vehicle_model import Vehicle
from src.services.inspection_alert_service import handle_inspection_alert
import asyncio
from datetime import datetime, timezone
from uuid import UUID
from fastapi import HTTPException
from sqlalchemy.orm import Session
from ..models.user_model import User, UserRole
from ..models.vehicle_inspection_model import VehicleInspection
from ..schemas.check_vehicle_schema import VehicleInspectionSchema
from ..services.user_notification import create_system_notification
from ..utils.socket_manager import sio
from ..models.ride_model import Ride, RideStatus

from ..models.notification_model import Notification, NotificationType


async def create_inspection(data: VehicleInspectionSchema, db: Session):
    print('inspection data', data)
    try:
        inspection = VehicleInspection(
            inspection_date=datetime.now(timezone.utc),
            inspected_by=data.inspected_by,
            vehicle_id=data.vehicle_id,
            clean=data.is_clean,
            fuel_checked=not data.is_unfueled,
            no_items_left=not data.has_items_left,
            critical_issue_bool=data.has_critical_issue,
            issues_found=data.issues_found.strip() if data.issues_found else None,
        )

        db.add(inspection)
        db.commit()
        db.refresh(inspection)

        vehicle = db.query(Vehicle).filter(Vehicle.id == data.vehicle_id).first()
        if not vehicle or not vehicle.last_user_id:
            print("No last_user_id found for vehicle, skipping notification.")
            return inspection

        last_user_id = vehicle.last_user_id
        last_ride = (
        db.query(Ride)
        .filter(
            Ride.vehicle_id == data.vehicle_id,
            Ride.user_id == last_user_id
        )
        .order_by(Ride.submitted_at.desc())
        .first()
    )



        if last_user_id:
            issues = []
            if not inspection.clean:
                issues.append("הרכב הוחזר מלוכלך")
            if not inspection.fuel_checked:
                issues.append("הרכב הוחזר לא מתודלק")
            if not inspection.no_items_left:
                issues.append("נשארו חפצים ברכב")

            plate_number = vehicle.plate_number  
            inspection_date_str = inspection.inspection_date.strftime("%d/%m/%Y %H:%M")

            if len(issues) == 1:
                message = f"שים לב ברכב {plate_number} בתאריך {inspection_date_str}: {issues[0]}."
            elif len(issues) > 1:
                message = f"נמצאו מספר ליקויים ברכב {plate_number} בתאריך {inspection_date_str}. אנא צור קשר עם זלמן."
            else:
                message = None  


            if message:
                title = "תוצאות בדיקת הרכב"
                notification = Notification(
                    user_id=last_user_id,
                    title=title,
                    message=message,
                    vehicle_id=data.vehicle_id,
                    order_id=last_ride.id if last_ride else None,
                    notification_type=NotificationType.system,
                    seen=False
                )


                db.add(notification)
                db.commit()
                db.refresh(notification)
                try:
                    await sio.emit("new_notification", {
                        "id": str(notification.id),
                        "user_id": str(notification.user_id),
                        "title": notification.title,
                        "message": notification.message,
                        "notification_type": notification.notification_type.value,
                        "sent_at": notification.sent_at.isoformat(),
                        "vehicle_id": str(data.vehicle_id),
                        "seen": False
                    })
                except Exception as socket_error:
                    print(f"Socket emission failed: {socket_error}")
        try:
            await sio.emit("new_inspection", {
                "inspection_id": str(inspection.inspection_id),
                "inspection_date": inspection.inspection_date.isoformat(),
                "inspected_by": str(inspection.inspected_by),
                "vehicle_id": str(inspection.vehicle_id),
                "clean": inspection.clean,
                "fuel_checked": inspection.fuel_checked,
                "no_items_left": inspection.no_items_left,
                "critical_issue_bool": inspection.critical_issue_bool,
                "issues_found": inspection.issues_found,
            })
        except Exception as socket_error:
            print(f"Socket emission failed: {socket_error}")

        return inspection

    except Exception as e:
        db.rollback()
        print(f"Failed on vehicle_id={data.vehicle_id}: {e}")
        raise HTTPException(status_code=500, detail="אירעה שגיאה בעת שמירת בדיקת הרכב.")    
