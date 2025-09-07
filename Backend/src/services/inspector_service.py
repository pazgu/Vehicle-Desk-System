from src.services.inspection_alert_service import handle_inspection_alert  # תתאימי את הנתיב
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
            print(f"❌ Socket emission failed: {socket_error}")

        return inspection

    except Exception as e:
        db.rollback()
        print(f"Failed on vehicle_id={data.vehicle_id}: {e}")
        raise HTTPException(status_code=500, detail="אירעה שגיאה בעת שמירת בדיקת הרכב.")