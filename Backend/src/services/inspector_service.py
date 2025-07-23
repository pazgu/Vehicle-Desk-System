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
        # Extract sets of vehicle IDs per issue type
        dirty_set = set(data.dirty_vehicle_ids or [])
        items_left_set = set(data.items_left_vehicle_ids or [])
        critical_set = set(data.critical_issue_vehicle_ids or [])

        # Merge all into a set of affected vehicle IDs
        all_vehicle_ids = dirty_set.union(items_left_set, critical_set)

        inspections_created = []

        for vehicle_id in all_vehicle_ids:
            inspection = VehicleInspection(
                inspection_date=data.inspection_date or datetime.now(timezone.utc),
                inspected_by=data.inspected_by,
                clean=data.clean,
                fuel_checked=data.fuel_checked,
                no_items_left=data.no_items_left,
                critical_issue_bool=vehicle_id in critical_set,
                issues_found=data.issues_found,
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

            # Emit socket event
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
                print(f"📢 Emitted new_inspection for {inspection.inspection_id}")
            except Exception as socket_error:
                print("❌ Failed to emit new_inspection event:", socket_error)

            # Send email if critical issue is found
            if inspection.critical_issue_bool and inspection.issues_found and inspection.issues_found.strip():
                inspector = db.query(User).filter(User.employee_id == data.inspected_by).first()
                inspector_name = f"{inspector.first_name} {inspector.last_name}" if inspector else "לא ידוע"

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
                    print(f"📧 Email sent to {user.username} ({email})")

        return inspections_created

    except Exception as e:
        print("❌ Failed to save inspection:", e)
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save inspection.")
