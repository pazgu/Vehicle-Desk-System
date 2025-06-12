from ..services.user_notification import create_system_notification
from ..models.user_model import User
from sqlalchemy.orm import Session
from uuid import UUID
from ..models.vehicle_inspection_model import VehicleInspection
from ..schemas.check_vehicle_schema import VehicleInspectionSchema
from datetime import datetime
from fastapi import HTTPException


def create_inspection(data: VehicleInspectionSchema, db: Session):
    try:
        print("🛠️ Creating new inspection with data:", data.dict())

        inspection = VehicleInspection(
            inspected_by=data.inspected_by,
            fuel_level=data.fuel_level,
            tires_ok=data.tires_ok,
            clean=data.clean,
            issues_found=data.issues_found,
            inspection_date=data.inspection_date or datetime.utcnow().date()
        )

        db.add(inspection)
        db.commit()
        db.refresh(inspection)

        # Log success
        print("✅ Inspection saved:", inspection.id)

        # Send critical issue notification if relevant
        if data.issues_found and "critical_event" in data.issues_found and data.issues_found["critical_event"].strip():
            admin_users = db.query(User).filter(User.role == "admin").all()
            print("📢 Sending critical issue notification to admins:", [a.employee_id for a in admin_users])
            for admin in admin_users:
                create_system_notification(
                    user_id=admin.employee_id,
                    title="🚨 דיווח חריג בבדיקת רכב",
                    message=f"זוהתה בעיה חמורה: {data.issues_found['critical_event']}",
                )
                print(f"🔔 Notification sent to admin {admin.username} (ID: {admin.employee_id})")


        return inspection
    
    except Exception as e:
        print("❌ Failed to save inspection:", e)
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save inspection.")