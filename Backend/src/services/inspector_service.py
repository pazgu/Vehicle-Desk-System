from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models.user_model import User
from ..models.vehicle_inspection_model import VehicleInspection
from ..schemas.check_vehicle_schema import VehicleInspectionSchema
from ..services.user_notification import create_system_notification


def create_inspection(data: VehicleInspectionSchema, db: Session):
    """
    Creates and saves a vehicle inspection record.
    Sends critical issue notifications to all admin users if needed.
    """
    try:
        inspection = VehicleInspection(
            inspection_date=data.inspection_date or datetime.now(timezone.utc),
            inspected_by=data.inspected_by,
            clean=data.clean,
            fuel_checked=data.fuel_checked,
            no_items_left=data.no_items_left,
            critical_issue_bool=data.critical_issue_bool,
            issues_found=data.issues_found,
        )

        db.add(inspection)
        db.commit()
        db.refresh(inspection)
        print(f"✅ Inspection saved: {inspection.inspection_id}")

        # Notify admins if a critical issue was reported
        if data.critical_issue_bool and data.issues_found and data.issues_found.strip():
            admin_users = db.query(User).filter(User.role == "admin").all()
            for admin in admin_users:
                create_system_notification(
                    user_id=admin.employee_id,
                    title="🚨 דיווח חריג בבדיקת רכב",
                    message=f"זוהתה בעיה חמורה: {data.issues_found}",
                )
                print(f"🔔 Notification sent to admin {admin.username} (ID: {admin.employee_id})")

        return {
            "message": "Inspection saved successfully",
            "inspection_id": str(inspection.inspection_id)
        }

    except Exception as e:
        print("❌ Failed to save inspection:", e)
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save inspection.")
    