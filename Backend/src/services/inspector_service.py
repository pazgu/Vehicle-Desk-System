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
from ..services.email_service import (
    async_send_email,
    render_email_template,
    get_user_email
)
async def create_inspection(data: VehicleInspectionSchema, db: Session):
    try:
        dirty_set = set(data.dirty_vehicle_ids or [])
        items_left_set = set(data.items_left_vehicle_ids or [])
        critical_set = set(data.critical_issue_vehicle_ids or [])

        all_vehicle_ids = dirty_set.union(items_left_set, critical_set)
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
                inspection_date=data.inspection_date or datetime.now(timezone.utc),
                inspected_by=data.inspected_by,
                clean=data.clean,
                fuel_checked=data.fuel_checked,
                no_items_left=data.no_items_left,
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
            print(f"✅ Inspection saved: {inspection.inspection_id}")

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
                print(f"📢 Emitted socket event for inspection {inspection.inspection_id}")
            except Exception as socket_error:
                print(f"❌ Socket emission failed: {socket_error}")
            print('before inspection critical issue')
            print(f"inspection critical:{inspection.critical_issue_bool}")
            await handle_inspection_alert(db, inspection)
            print('after inspection alert')
            if inspection.critical_issue_bool and inspection.issues_found:
                inspector = db.query(User).filter(User.employee_id == inspection.inspected_by).first()
                inspector_name = f"{inspector.first_name} {inspector.last_name}" if inspector else "לא ידוע"

                recipients = db.query(User).filter(User.role==UserRole.admin).all()

                for user in recipients:
                    email = get_user_email(user.employee_id, db)
                    if not email:
                        print(f"⚠️ No email for user {user.username}, skipping.")
                        continue

                    context = {
                        "inspection_date": inspection.inspection_date.strftime("%d/%m/%Y %H:%M"),
                        "inspector_name": inspector_name,
                        "issues_found": inspection.issues_found,
                        "critical_issue_bool": "כן" if inspection.critical_issue_bool else "לא",
                        "clean": "כן" if inspection.clean else "לא",
                        "fuel_checked": "כן" if inspection.fuel_checked else "לא",
                        "no_items_left": "כן" if inspection.no_items_left else "לא",
                    }

                    html_content = render_email_template("critical_issue_admin.html", context)

                    try:
                        await async_send_email(
                            to_email=email,
                            subject="🚨 דווח תקלה קריטית בבדיקת רכב",
                            html_content=html_content
                        )
                        print(f"Email sent to {user.username} ({email}) for indpection")
                    except Exception as mail_err:
                        print(f"Failed to send email to {user.username}: {mail_err}")

                    try:
                        create_system_notification(
                            user_id=user.employee_id,
                            title="דווחה תקלה קריטית ברכב",
                            message=f"בדיקת רכב חשפה תקלה חמורה: {inspection.issues_found}",
                            order_id=None,
                            vehicle_id=inspection.critical_issue_vehicle_id,
                            relevant_user_id=inspection.inspected_by
                        )
                        print(f"🔔 Notification created for {user.username}")
                    except Exception as notif_err:
                        print(f"❌ Failed to create notification: {notif_err}")

        return inspections_created

    except Exception as e:
        print("❌ Failed to save inspection:", e)
        db.rollback()
        raise HTTPException(status_code=500, detail="אירעה שגיאה בעת שמירת בדיקת הרכב.")
