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
        dirty_set = set(data.dirty_vehicle_ids or [])
        items_left_set = set(data.items_left_vehicle_ids or [])
        critical_set = set(data.critical_issue_vehicle_ids or [])
        unfueled_set = set(data.unfueled_vehicle_ids or [])


        all_vehicle_ids = dirty_set.union(items_left_set, critical_set, unfueled_set)
        inspections_created = []

        for vehicle_id in all_vehicle_ids:
            issue_record = None
            if data.issues_found:
                issue_record = next(
                    (item for item in data.issues_found if item.vehicle_id == vehicle_id),
                    None
                )
            issue_text = issue_record.issue_found.strip() if issue_record and issue_record.issue_found else None

            inspection = VehicleInspection(
                inspection_date=datetime.now(timezone.utc),
                inspected_by=data.inspected_by,
                clean= False if vehicle_id in dirty_set else True,
                unfueled_vehicle_id=vehicle_id if vehicle_id in unfueled_set else None,
                fuel_checked=vehicle_id in unfueled_set,   # Updated here
                no_items_left=False if vehicle_id in items_left_set else True,
                critical_issue_bool=vehicle_id in critical_set,
                issues_found=issue_text,
                dirty_vehicle_id=vehicle_id if vehicle_id in dirty_set else None,
                items_left_vehicle_id=vehicle_id if vehicle_id in items_left_set else None,
                critical_issue_vehicle_id=vehicle_id if vehicle_id in critical_set else None,
            )

            db.add(inspection)
            inspections_created.append(inspection)  

        db.commit()

        for inspection in inspections_created:
            db.refresh(inspection)

            try:
                await sio.emit("new_inspection", {
                    "inspection_id": str(inspection.inspection_id),
                    "inspection_date": inspection.inspection_date.isoformat(),
                    "inspected_by": str(inspection.inspected_by),
                    "fuel_checked": inspection.fuel_checked,
                    "no_items_left": inspection.no_items_left,
                    "critical_issue_bool": inspection.critical_issue_bool,
                    "issues_found": inspection.issues_found,
                })
            except Exception as socket_error:
                print(f"❌ Socket emission failed: {socket_error}")

            # ... rest of your email and notification code here ...

        return inspections_created

    except Exception as e:
        db.rollback()
        print(f"Failed on vehicle_id={vehicle_id}: {e}")
        raise HTTPException(status_code=500, detail="אירעה שגיאה בעת שמירת בדיקת הרכב.{e}")
