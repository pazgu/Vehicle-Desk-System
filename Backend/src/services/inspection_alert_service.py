from datetime import datetime
from sqlalchemy.orm import Session
from uuid import UUID
from src.models.user_model import User
from src.models.vehicle_model import Vehicle
from src.models.vehicle_inspection_model import VehicleInspection
from src.services.email_service import async_send_email, render_email_template
from src.services.user_notification import create_system_notification_with_db

async def handle_inspection_alert(db: Session, inspection: VehicleInspection):
    print("entered handle_inspection_alert")
    

    date_str = inspection.inspection_date.strftime("%d/%m/%Y %H:%M")
    # בודקים אם יש רכבים עם בעיות בדיווח
    # dirty vehicle
    if inspection.dirty_vehicle_id:
        vehicle = db.query(Vehicle).filter(Vehicle.id == inspection.dirty_vehicle_id).first()
        if vehicle and vehicle.last_user_id:
            user = db.query(User).filter(User.employee_id == vehicle.last_user_id).first()
            if user:
                context = {
                    "user_name": f"{user.first_name} {user.last_name}",
                    "license_plate": vehicle.plate_number,
                    "date": date_str,
                }
                subject = "הרכב שהשתמשת בו סומן כלא נקי"
                html_content = render_email_template("vehicle_dirty.html", context)
                await async_send_email(user.email, subject, html_content)
                # שליחת נוטיפ בדשבורד
                create_system_notification_with_db(db, user.employee_id,title='רכב לא נקי',
                    message="הרכב שבו השתמשת דווח כלא נקי בבדיקה האחרונה.")

    # items left
    if inspection.items_left_vehicle_id:
        vehicle = db.query(Vehicle).filter(Vehicle.id == inspection.items_left_vehicle_id).first()
        if vehicle and vehicle.last_user_id:
            user = db.query(User).filter(User.employee_id == vehicle.last_user_id).first()
            if user:
                context = {
                    "user_name": f"{user.first_name} {user.last_name}",
                    "license_plate": vehicle.plate_number,
                    "date": date_str,
                }
                subject = "נמצאו חפצים ברכב שבו נסעת"
                html_content = render_email_template("forgotten_items.html", context)
                await async_send_email(user.email, subject, html_content)
                create_system_notification_with_db(db, user.employee_id,title='רכב שנשארו בו חפצים',
                    message="נמצאו חפצים ברכב שבו נסעת.")

    # critical issue - שולחים למנהל (נניח שמנהל הוא עם role='admin')
    if inspection.critical_issue_vehicle_id:
        vehicle = db.query(Vehicle).filter(Vehicle.id == inspection.critical_issue_vehicle_id).first()
        if vehicle:
            admins = db.query(User).filter(User.role == "admin").all()
            context = {
                "license_plate": vehicle.plate_number,
                "date": date_str,
                "issue_description": inspection.issues_found or "אירוע חריג ללא פירוט",
            }
            subject = f"אירוע חריג דווח ברכב {vehicle.plate_number}"
            html_content = render_email_template("critical_issue_admin.html", context)
            for admin in admins:
                await async_send_email(admin.email, subject, html_content)
                create_system_notification_with_db(db, admin.employee_id,title='רכב עם בעיה חריגה',
                    message=f"דווחה חריגה ברכב מספר {vehicle.plate_number}")
