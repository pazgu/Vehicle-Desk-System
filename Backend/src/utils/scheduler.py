import asyncio

from dotenv import load_dotenv
from fastapi import HTTPException

from ..models.audit_log_model import AuditLog
from ..models.monthly_vehicle_usage_model import MonthlyVehicleUsage
from sqlalchemy.dialects.postgresql import UUID
from ..models.city_model import City
from ..services.email_service import async_send_email, load_email_template
from ..models.notification_model import Notification
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from ..models.department_model import Department
from ..models.vehicle_model import Vehicle
from ..services.user_form import get_ride_needing_feedback
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, time, timezone
from ..utils.database import SessionLocal
from ..models.user_model import User
from ..models.ride_model import Ride, RideStatus
from ..services.user_notification import create_system_notification, emit_new_notification, get_user_name
import pytz
from apscheduler.jobstores.base import JobLookupError
from datetime import datetime, timedelta
from ..services.form_email import send_ride_completion_email
from ..services.supervisor_dashboard_service import start_ride 
from sqlalchemy.orm import Session
from ..utils.socket_manager import sio
import os
load_dotenv() 
BOOKIT_URL = os.getenv("BOOKIT_FRONTEND_URL", "http://localhost:4200")

scheduler = BackgroundScheduler(timezone=pytz.timezone("Asia/Jerusalem"))
from ..services.email_service import get_user_email, load_email_template, async_send_email
from ..services.user_notification import create_system_notification,get_supervisor_id,get_user_name
import logging
main_loop = asyncio.get_event_loop()
logger = logging.getLogger(__name__)
from sqlalchemy import and_, cast, func, or_



def schedule_ride_start(ride_id: str, start_datetime: datetime):
    print('start ride was scheduled')
    run_time = start_datetime
    job_id = f"ride-start-{ride_id}"

    # Avoid duplicates
    try:
        scheduler.remove_job(job_id)
    except JobLookupError:
        pass

    # Use a sync wrapper to call the async function
    scheduler.add_job(
        lambda: asyncio.run(start_ride_with_new_session(ride_id)),
        'date',
        run_date=run_time,
        id=job_id
    )

    

async def start_ride_with_new_session(ride_id: str):
    print('start ride with new session was called')
    db = SessionLocal()
    try:
        ride = db.query(Ride).filter(Ride.id == ride_id).first()
        if not ride:
            raise HTTPException(status_code=404, detail="Ride not found")

        if ride.status != RideStatus.approved:
            raise HTTPException(status_code=400, detail="Ride must be approved before starting")

        # ride=res[0]
        # vehicle=res[1]
         # 3️⃣ Emit ride update
        # await sio.emit("ride_status_updated", {
        #     "ride_id": str(ride.id),
        #     "new_status": ride.status.value
        # })
        # # 4️⃣ Emit vehicle update
        # await sio.emit("vehicle_status_updated", {
        #     "id": str(vehicle.id),
        #     "status": vehicle.status.value
        # })
        await sio.emit("ride_supposed_to_start", {
            "ride_id": str(ride.id)
        })
    finally:
        db.close()


def check_and_complete_rides():
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        rides_to_complete = db.query(Ride).filter(
            Ride.status == "approved",
            Ride.end_datetime <= now
        ).all()

        for ride in rides_to_complete:
            ride.status = "completed"
            print(f"✅ Ride {ride.id} marked as completed")

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"❌ Error while updating completed rides: {e}")
    finally:
        db.close()

async def check_inactive_vehicles():
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        one_week_ago = now - timedelta(days=7)

        # Get all vehicles
        all_vehicles = db.query(Vehicle).all()

        # Get latest ride per vehicle (if any)
        recent_rides_subq = db.query(
            Ride.vehicle_id,
            func.max(Ride.end_datetime).label("last_ride")
        ).filter(
            Ride.status == "completed"
        ).group_by(Ride.vehicle_id).subquery()

        # Join vehicles to recent ride
        inactive_vehicles = db.query(Vehicle, recent_rides_subq.c.last_ride).outerjoin(
            recent_rides_subq, Vehicle.id == recent_rides_subq.c.vehicle_id
        ).filter(
            or_(
                recent_rides_subq.c.last_ride == None,
                recent_rides_subq.c.last_ride < one_week_ago
            )
        ).all()

        if not inactive_vehicles:
            return

        admins = db.query(User).filter(User.role == "admin").all()

        for vehicle, last_ride in inactive_vehicles:
            last_used_date = last_ride.date() if last_ride else "לא ידוע"

            for admin in admins:
                # Check if already notified
                exists = db.query(Notification).filter(
                    Notification.user_id == admin.employee_id,
                    Notification.vehicle_id == vehicle.id,
                    Notification.title == "Inactive Vehicle"
                ).first()

                if exists:
                    continue

                notif = create_system_notification(
                    user_id=admin.employee_id,
                    title="Inactive Vehicle",
                    message=f"הרכב עם מספר רישוי {vehicle.plate_number} לא היה בשימוש מאז {last_used_date}",
                    vehicle_id=vehicle.id
                )

                admin_email = get_user_email(admin.employee_id, db)
                if admin_email:
                    html_content = load_email_template("inactive_vehicle.html", {
                        "ADMIN_NAME": get_user_name(db, admin.employee_id),
                        "VEHICLE": vehicle.vehicle_model,
                        "PLATE_NUMBER": vehicle.plate_number,
                        "LAST_RIDE_DATE": last_used_date
                    })
                    await async_send_email(
                        to_email=admin_email,
                        subject="קיים במערכת רכב שלא היה בשימוש מעל לשבוע ",
                        html_content=html_content
                    )

                await sio.emit("vehicle_expiry_notification", {
                    "id": str(notif.id),
                    "user_id": str(notif.user_id),
                    "title": notif.title,
                    "message": notif.message,
                    "notification_type": notif.notification_type.value,
                    "sent_at": notif.sent_at.isoformat(),
                    "vehicle_id": str(vehicle.id),
                    "plate_number": vehicle.plate_number
                }, room=str(admin.employee_id))

    finally:
        db.close()


async def check_vehicle_lease_expiry():
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        three_months_later = now + timedelta(days=90)

        # Join Vehicle -> Department
        vehicles_expiring = db.query(Vehicle).join(
            Department, Vehicle.department_id == Department.id
        ).filter(
            Vehicle.lease_expiry <= three_months_later,
            Vehicle.lease_expiry >= now
        ).with_entities(Vehicle, Department).all()
        print('b4: expiring vehicles were found',vehicles_expiring)
        print('before if')

        if not vehicles_expiring:
            return
        
        print('expiring vehicles were found',vehicles_expiring)
        # Get all admins once
        admins = db.query(User).filter(User.role == "admin").all()
        print("admins found:", admins)

        # Print usernames
        admin_usernames = [admin.username for admin in admins]
        print("admin usernames:", admin_usernames)

        for vehicle, department in vehicles_expiring:
            supervisor_id = department.supervisor_id

            if supervisor_id:
                exists = db.query(Notification).filter(
                    Notification.user_id == supervisor_id,
                    Notification.vehicle_id == vehicle.id,
                    Notification.title == "Vehicle Lease Expiry"
                ).first()
                if not exists:
                    notif = create_system_notification(
                        user_id=supervisor_id,
                        title="Vehicle Lease Expiry",
                        message = f"תוקף השימוש ברכב עם מספר רישוי {vehicle.plate_number} יפוג בתאריך {vehicle.lease_expiry.date()}",                        
                        vehicle_id=vehicle.id
                    )


                    supervisor_email = get_user_email(supervisor_id, db)
                    if supervisor_email:
                        html_content = load_email_template("lease_expired.html", {
                            "SUPERVISOR_NAME": get_user_name(db, supervisor_id),
                            "VEHICLE_ID": vehicle.id,
                            "VEHICLE": vehicle.vehicle_model,
                            "PLATE": vehicle.plate_number,
                            "PLATE_NUMBER": vehicle.plate_number,
                            "EXPIRY_DATE": vehicle.lease_expiry
                            })
                        await async_send_email(
                            to_email=supervisor_email,
                            subject="קיים במערכת רכב שתקפו יפוג בקרוב",
                            html_content=html_content
                        )
                    else:
                        logger.warning("No supervisor email found — skipping email.")


                    await sio.emit("vehicle_expiry_notification", {
                        "id": str(notif.id),
                        "user_id": str(notif.user_id),
                        "title": notif.title,
                        "message": notif.message,
                        "notification_type": notif.notification_type.value,
                        "sent_at": notif.sent_at.isoformat(),
                        "vehicle_id": str(vehicle.id),
                        "plate_number": vehicle.plate_number
                    }, room=str(supervisor_id))

            # Notify all admins too
            for admin in admins:
                exists_admin = db.query(Notification).filter(
                    Notification.user_id == admin.employee_id,
                    Notification.vehicle_id == vehicle.id,
                    Notification.title == "Vehicle Lease Expiry"
                ).first()
                if not exists_admin:
                    print('admin sent to:',admin.username)
                    admin_notif = create_system_notification(
                        user_id=admin.employee_id,
                        title="Vehicle Lease Expiry",
                        message = f"תוקף השימוש ברכב עם מספר רישוי {vehicle.plate_number} יפוג בתאריך {vehicle.lease_expiry.date()}",                        
                        vehicle_id=vehicle.id
                        )
                    
                    admin_email = get_user_email(admin.employee_id, db)
                    if admin_email:
                        html_content = load_email_template("lease_expired.html", {
                            "SUPERVISOR_NAME": get_user_name(db, admin.employee_id),
                            "VEHICLE_ID": vehicle.id,
                            "VEHICLE": vehicle.vehicle_model,
                            "PLATE": vehicle.plate_number,
                            "PLATE_NUMBER": vehicle.plate_number,
                            "EXPIRY_DATE": vehicle.lease_expiry
                            })
                        await async_send_email(
                            to_email=admin.email,
                            subject="קיים במערכת רכב שתקפו יפוג בקרוב",
                            html_content=html_content
                        )
                    else:
                        logger.warning("No supervisor email found — skipping email.")


                    await sio.emit("vehicle_expiry_notification", {
                        "id": str(admin_notif.id),
                        "user_id": str(admin_notif.user_id),
                        "title": admin_notif.title,
                        "message": admin_notif.message,
                        "notification_type": admin_notif.notification_type.value,
                        "sent_at": admin_notif.sent_at.isoformat(),
                        "vehicle_id": str(vehicle.id),
                        "plate_number": vehicle.plate_number
                    }, room=str(admin.employee_id))

    finally:
        db.close()

async def delete_old_archived_vehicles():
    """
    Checks for vehicles that have been archived for more than three months
    and deletes them, along with ALL their associated records from specified tables.
    """
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        three_months_ago = now - timedelta(days=90) # Approximately 3 months

        # 1. Find vehicles to delete
        vehicles_to_delete = db.query(Vehicle).filter(
            and_(
                Vehicle.is_archived == True,
                Vehicle.archived_at <= three_months_ago
            )
        ).all()

        if not vehicles_to_delete:
            print("No old archived vehicles found for deletion.")
            return

        print(f"Found {len(vehicles_to_delete)} archived vehicles older than 3 months to delete.")

        for vehicle in vehicles_to_delete:
            print(f"\nProcessing vehicle ID: {vehicle.id}, Plate Number: {vehicle.plate_number}, Archived At: {vehicle.archived_at}")

            # --- Delete related records in specific order (children first) ---

            # Delete related Notifications (tbl: notifications, col: vehicle_id)
            notifications_to_delete = db.query(Notification).filter(
                Notification.vehicle_id == vehicle.id
            ).all()
            if notifications_to_delete:
                print(f"  Deleting {len(notifications_to_delete)} notifications for vehicle ID {vehicle.id}...")
                for notification in notifications_to_delete:
                    db.delete(notification)
            else:
                print(f"  No notifications found for vehicle ID {vehicle.id}.")

            # Delete related Rides (tbl: rides, col: vehicle_id)
            rides_to_delete = db.query(Ride).filter(
                Ride.vehicle_id == vehicle.id
            ).all()
            if rides_to_delete:
                print(f"  Deleting {len(rides_to_delete)} rides for vehicle ID {vehicle.id}...")
                for ride in rides_to_delete:
                    db.delete(ride)
            else:
                print(f"  No rides found for vehicle ID {vehicle.id}.")

            # Delete related Monthly Vehicle Usage (tbl: monthly_vehicle_usage, col: vehicle_id)
            # Assuming 'vehicle_id' is the correct column name, not 'vehivle_id'
            monthly_usage_to_delete = db.query(MonthlyVehicleUsage).filter(
                MonthlyVehicleUsage.vehicle_id == vehicle.id
            ).all()
            if monthly_usage_to_delete:
                print(f"  Deleting {len(monthly_usage_to_delete)} monthly vehicle usage records for vehicle ID {vehicle.id}...")
                for usage in monthly_usage_to_delete:
                    db.delete(usage)
            else:
                print(f"  No monthly vehicle usage records found for vehicle ID {vehicle.id}.")

            # Delete related Audit Logs (tbl: audit_logs, col: entity_id)
            audit_logs_to_delete = db.query(AuditLog).filter(
                # Use and_ to combine multiple conditions properly
                and_(
                    cast(AuditLog.entity_id, UUID) == vehicle.id,
                    AuditLog.entity_type == 'Vehicle'
                )
            ).all()
            if audit_logs_to_delete:
                print(f"  Deleting {len(audit_logs_to_delete)} audit log entries for vehicle ID {vehicle.id}...")
                for log in audit_logs_to_delete:
                    db.delete(log)
            else:
                print(f"  No audit log entries found for vehicle ID {vehicle.id}.")

            # Delete related Archived Audit Logs (tbl: audit_logs_archive, col: entity_id)
            # audit_logs_archive_to_delete = db.query(AuditLogArchive).filter(
            #     AuditLogArchive.entity_id == vehicle.id
            #     # IMPORTANT: Same as above, if AuditLogArchive has an 'entity_type' column, add a filter:
            #     # and_(AuditLogArchive.entity_id == vehicle.id, AuditLogArchive.entity_type == 'Vehicle')
            # ).all()
            # if audit_logs_archive_to_delete:
            #     print(f"  Deleting {len(audit_logs_archive_to_delete)} archived audit log entries for vehicle ID {vehicle.id}...")
            #     for log in audit_logs_archive_to_delete:
            #         db.delete(log)
            # else:
            #     print(f"  No archived audit log entries found for vehicle ID {vehicle.id}.")

            # 2. Finally, delete the Vehicle itself
            print(f"  Deleting vehicle ID: {vehicle.id}")
            db.delete(vehicle)

        db.commit()
        print("\nSuccessfully deleted old archived vehicles and all their associated records.")

    except Exception as e:
        db.rollback()
        print(f"An error occurred during deletion of old archived vehicles and their related data: {e}")
        # Log this error properly in a real application
    finally:
        db.close()
        
async def notify_ride_needs_feedback(user_id: int):
    print(f'Notifying feedback needed for user {user_id}')
    db = SessionLocal()
    try:
        ride = get_ride_needing_feedback(db, user_id)
        if ride is None:
            print("No ride needs feedback")
            return {"needs_feedback": False}

        print(f"About to emit ride_feedback_needed for ride {ride.id}")

        await sio.emit("feedback_needed", {
            "showPage": True,
            "ride_id": str(ride.id),
            "message": "הנסיעה הסתיימה, נא למלא את הטופס"
        })

        print(f"Emit done for ride {ride.id}")

    finally:
        db.close()

def periodic_check():
    db = SessionLocal()
    try:
        user_ids = [user.id for user in db.query(User).all()]
    finally:
        db.close()
    for user_id in user_ids:  # Example user IDs
        future = asyncio.run_coroutine_threadsafe(
            notify_ride_needs_feedback(user_id),
            main_loop
        )
        try:
            result = future.result(timeout=5)
            print('Coroutine result:', result)
        except Exception as e:
            print('Coroutine error:', e)


def check_and_schedule_ride_emails():
    db = SessionLocal()
    try:
        now = datetime.now()
        rides = db.query(Ride).filter(
            Ride.end_datetime < now,
            Ride.status != "completed"
        ).all()

        for ride in rides:
            send_ride_completion_email(ride.id)
            print(f"📨 Email sent for ride {ride.id}")
    finally:
        db.close()

scheduler.add_job(check_and_schedule_ride_emails, 'interval', minutes=5)
scheduler.add_job(check_and_complete_rides, 'interval', minutes=5)

def notify_admins_daily():
    print("⏰ Scheduler is triggering notification function.")

    db = SessionLocal()
    try:
        admins = db.query(User).filter(User.role == "admin").all()
        for admin in admins:
            create_system_notification(
                user_id=admin.employee_id,
                title="📋 תזכורת יומית",
                message="אנא בדוק את כל בדיקות הרכב שבוצעו היום."
            )
        print(f"[{datetime.now()}] ✅ Sent daily admin inspection reminder.")
    finally:
        db.close()


async def check_ride_status_and_notify_user():
    """
    Checks for pending/rejected rides ending within 24 hours and notifies the user.
    Prevents duplicate notifications for the same ride status update.
    """
    db: Session = SessionLocal()
    try:
        notification_title_prefix = "עדכון סטטוס נסיעה"
        
        now = datetime.now(timezone.utc)
        twenty_four_hours_later = now + timedelta(hours=24)

        rides_to_notify = db.query(Ride).filter(
            Ride.status.in_([RideStatus.pending, RideStatus.rejected]),
            Ride.end_datetime <= twenty_four_hours_later,
            Ride.end_datetime >= now # Ensures we only check for future or current end times
        ).all()

        if not rides_to_notify:
            print("No pending or rejected rides ending soon found to notify.")
            return

        print(f"Found {len(rides_to_notify)} pending/rejected rides ending soon to process.")

        for ride in rides_to_notify:
            user = db.query(User).filter(User.employee_id == ride.user_id).first()
            if not user:
                print(f"User not found for ride ID {ride.id}. Skipping notification.")
                continue

            user_email = user.email
            user_name = get_user_name(db, user.employee_id) or "משתמש יקר"

            if ride.status == RideStatus.pending:
                status_hebrew = "ממתין לאישור"
                status_color = "#FFC107"
                status_message = "בקשתך ממתינה לאישור. אנא המתן בסבלנות."
                subject = f"✅ בקשתך ממתינה לאישור: נסיעה ליעד {ride.stop}" 
            elif ride.status == RideStatus.rejected:
                status_hebrew = "נדחתה"
                status_color = "#DC3545"
                status_message = "בקשתך נדחתה. ייתכן שאין רכב זמין או שהבקשה אינה עומדת בתנאים."
                subject = f"❌ בקשתך נדחתה: נסיעה ליעד {ride.stop}" 
            else:
                continue 

            destination_name = str(ride.stop)
            if ride.stop:
                city = db.query(City).filter(City.id == ride.stop).first()
                if city:
                    destination_name = city.name
                
            plate_number = "טרם שויך רכב"
            if ride.vehicle_id:
                vehicle = db.query(Vehicle).filter(Vehicle.id == ride.vehicle_id).first()
                if vehicle:
                    plate_number = vehicle.plate_number

            # Check if a notification for this specific ride status update already exists
            existing_notif = db.query(Notification).filter(
                Notification.user_id == user.employee_id,
                Notification.order_id == ride.id, 
                Notification.title.like(f"{notification_title_prefix}{status_hebrew}") # More specific title check
            ).first()

            if not existing_notif:
                notif_message = f" הנסיעה שלך ליעד {destination_name} עדיין לא אושרה"
                notification = create_system_notification(
                    user_id=user.employee_id,
                    title=f"{notification_title_prefix}{status_hebrew}",
                    message=notif_message,
                    order_id=ride.id
                )
                print(f"Created system notification for user {user.employee_id}, ride {ride.id}, status {status_hebrew}")

                await emit_new_notification(
                    notification=notification,
                    room=str(user.employee_id),
                )
                print(f"Emitted system notification via SIO for user {user.employee_id}")

                if user_email:
                    html_content = load_email_template("ride_status_update.html", {
                        "USER_NAME": user_name,
                        "STATUS_HEBREW": status_hebrew,
                        "STATUS_COLOR": status_color,
                        "STATUS_MESSAGE": status_message,
                        "RIDE_ID": str(ride.id),
                        "DESTINATION": destination_name,
                        "DATE_TIME": ride.start_datetime.strftime("%Y-%m-%d %H:%M"), 
                        "PLATE_NUMBER": plate_number,
                        "LINK_TO_RIDE": f"{BOOKIT_URL}/ride/details/{ride.id}" 
                    })
                    try:
                        await async_send_email(
                            to_email=user_email,
                            subject=subject,
                            html_content=html_content
                        )
                        print(f"Sent email notification to {user_email} for ride {ride.id} status {status_hebrew}")
                    except Exception as email_e:
                        print(f"Error sending email to {user_email} for ride {ride.id}: {repr(email_e)}")
                else:
                    print(f"No email found for user {user.employee_id} for ride {ride.id}. Skipping email notification.")
            else:
                print(f"Notification already sent for ride {ride.id} with status {status_hebrew}. Skipping.")

    except Exception as e:
        print(f"An error occurred in check_ride_status_and_notify_user: {repr(e)}")
    finally:
        db.close()

def schedule_ride_completion_email(ride_id: str, end_datetime: datetime):
    run_time = end_datetime + timedelta(minutes=5)
    job_id = f"ride-email-{ride_id}"

    # Avoid duplicate jobs
    try:
        scheduler.remove_job(job_id)
    except JobLookupError:
        pass

    scheduler.add_job(
        send_ride_completion_email,
        'date',
        run_date=run_time,
        args=[ride_id],
        id=job_id
    )


@scheduler.scheduled_job('interval', minutes=1)  # every 1 minute
def periodic_check():
    print("Periodic feedback check running...")
    db = SessionLocal()
    try:
        # Query all users who might need feedback
        user_ids = db.query(Ride.user_id).filter(
            Ride.end_datetime <= datetime.now(timezone.utc),
            Ride.feedback_submitted == False,
            Ride.status == RideStatus.in_progress
        ).distinct().all()
        
        for (user_id,) in user_ids:
            asyncio.run_coroutine_threadsafe(
                notify_ride_needs_feedback(user_id),
                main_loop
            )
    finally:
        db.close()


def periodic_check_vehicle():
    print('periodic_check_vehicle was called')
    future = asyncio.run_coroutine_threadsafe(check_inactive_vehicles(), main_loop)
    future = asyncio.run_coroutine_threadsafe(check_vehicle_lease_expiry(), main_loop)
    future.result(timeout=5)

def periodic_check_ride_status():
    print('periodic_check_ride_status was called')
    # Run the ride status check
    future_ride_status = asyncio.run_coroutine_threadsafe(check_ride_status_and_notify_user(), main_loop)
    try:
        future_ride_status.result(timeout=5)
    except Exception as e:
        print(f"Error running check_ride_status_and_notify_user: {e}")



 

def periodic_delete_archived_vehicles():
    print('periodic_delete_archived_vehicles was called')
    future = asyncio.run_coroutine_threadsafe(delete_old_archived_vehicles(), main_loop)
    try:
        future.result(timeout=60) # Increased timeout to 60 seconds
    except asyncio.TimeoutError:
        print("Timeout: delete_old_archived_vehicles took too long to complete.")
    except Exception as e:
        print(f"Error running delete_old_archived_vehicles: {e}")       



scheduler.add_job(periodic_check_vehicle, 'interval', days=1)
scheduler.add_job(periodic_check_ride_status, 'interval', seconds=60)
scheduler.add_job(periodic_delete_archived_vehicles, 'interval',  days=30)


scheduler.start()



def start_scheduler():
    scheduler.add_job(notify_admins_daily, 'cron', hour=6, minute=0)
    scheduler.start()



        
def start_scheduler():
    scheduler = BackgroundScheduler(timezone=pytz.timezone("Asia/Jerusalem"))
    scheduler.add_job(notify_admins_daily, 'cron', hour=6, minute=0)
    scheduler.start()

