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
from ..services.email_service import (
    async_send_email,
    render_email_template,
    get_user_email
)


async def create_inspection(data: VehicleInspectionSchema, db: Session):
    try:
        # יצירת האובייקט
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

        # שידור סוקט
        try:
            await sio.emit("new_inspection", {
                "inspection_id": str(inspection.inspection_id),
                "inspection_date": inspection.inspection_date.isoformat(),
                "inspected_by": str(inspection.inspected_by),
                "clean": inspection.clean,
                "fuel_checked": inspection.fuel_checked,
                "no_items_left": inspection.no_items_left,
                "critical_issue_bool": inspection.critical_issue_bool,
                "issues_found": inspection.issues_found,
            })
            print(f"📢 Emitted new_inspection event for {inspection.inspection_id}")
        except Exception as socket_error:
            print("❌ Failed to emit new_inspection event:", socket_error)

        # שליחת מייל על תקלה קריטית אם קיימת
     
        if data.critical_issue_bool and data.issues_found and data.issues_found.strip():
            inspector = db.query(User).filter(User.employee_id == data.inspected_by).first()
            inspector_name = f"{inspector.first_name} {inspector.last_name}" if inspector else "לא ידוע"

            # מביא גם סופרווייזורים וגם אדמינים
            recipients = db.query(User).filter(User.role.in_([UserRole.supervisor, UserRole.admin])).all()

            for user in recipients:
                email = get_user_email(user.employee_id, db)
                if not email:
                    print(f"⚠️ User {user.username} has no email, skipping.")
                    continue

                context = {
                    "inspection_date": inspection.inspection_date.strftime("%d/%m/%Y %H:%M"),
                    "inspector_name": inspector_name,
                    "issues_found": inspection.issues_found,
                    "critical_issue_bool": inspection.critical_issue_bool,
                    "clean": "כן" if inspection.clean else "לא",
                    "fuel_checked": "כן" if inspection.fuel_checked else "לא",
                    "no_items_left": "כן" if inspection.no_items_left else "לא",
                }

                html_content = render_email_template("issue_reported.html", context)

                await async_send_email(
                    to_email=email,
                    subject="🚨 דווח תקלה קריטית בבדיקת רכב",
                    html_content=html_content
                )

                print(f"📧 Critical issue email sent to {user.username} ({email})")

        return inspection

    except Exception as e:
        print("❌ Failed to save inspection:", e)
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save inspection.")

        # 