import asyncio

from dotenv import load_dotenv
from fastapi import HTTPException

from ..routes.admin_routes import get_no_show_events_count_per_user

from ..models.no_show_events import NoShowEvent

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
from datetime import datetime, timedelta, timezone, date
from ..services.email_clean_service import send_ride_completion_email
from ..services.supervisor_dashboard_service import start_ride 
from sqlalchemy.orm import Session,joinedload
from ..utils.socket_manager import sio
import os
import uuid
load_dotenv() 
BOOKIT_URL = os.getenv("BOOKIT_FRONTEND_URL", "http://localhost:4200")

scheduler = BackgroundScheduler(timezone=pytz.timezone("Asia/Jerusalem"))
from ..services.email_service import get_user_email, load_email_template, async_send_email
from ..services.user_notification import create_system_notification,get_supervisor_id,get_user_name
import logging
main_loop = asyncio.get_event_loop()
logger = logging.getLogger(__name__)
from sqlalchemy import and_, cast, func, or_, text



def schedule_ride_start(ride_id: str, start_datetime: datetime):
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
    db = SessionLocal()
    try:
        ride = db.query(Ride).filter(Ride.id == ride_id).first()
        if not ride:
            raise HTTPException(status_code=404, detail="Ride not found")
        
        if ride.status==RideStatus.cancelled_due_to_no_show:
            return

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



async def send_notif_to_inspector():
    db = SessionLocal()
    try:
       inspectors=db.query(User).filter(User.role == "inspector").all()
       for inspector in inspectors:
            notif = create_system_notification(
                            user_id=inspector.employee_id,
                            title="Inspector daily check",
                            message=f"נא לבצע הבדיקה היומית של הרכבים"
                        )
            await sio.emit("new_notification", {
                    "id": str(notif.id),
                    "user_id": str(notif.user_id),
                    "title": notif.title,
                    "message": notif.message,
                    "notification_type": notif.notification_type.value,
                    "sent_at": notif.sent_at.isoformat(),
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

        db.commit()
    except Exception as e:
        db.rollback()
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

        if not vehicles_expiring:
            return
        
        admins = db.query(User).filter(User.role == "admin").all()

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

async def check_and_cancel_unstarted_rides():
    db: Session = SessionLocal()
    try:
        now_utc = datetime.now(timezone.utc)
        two_hours_ago = now_utc - timedelta(hours=2)

        rides = db.query(Ride).filter(
            Ride.status == RideStatus.approved,
            Ride.start_datetime <= two_hours_ago,
            Ride.actual_pickup_time == None
        ).all()

        if not rides:
            return

        for ride in rides:
            ride.status = RideStatus.cancelled_due_to_no_show
            db.add(ride)

            vehicle = None
            if ride.vehicle_id:
                vehicle = db.query(Vehicle).filter(Vehicle.id == ride.vehicle_id).first()
                if vehicle:
                    vehicle.status = 'available'
                    db.add(vehicle)

            no_show_event = NoShowEvent(
                user_id=ride.user_id,
                ride_id=ride.id,
                occurred_at=now_utc.replace(tzinfo=None)
            )
            db.add(no_show_event)

            db.execute(
                text("SET session.audit.user_id = :user_id"),
                {"user_id": str(ride.user_id)}
            )

            # ✅ Commit before notifying (to ensure persistence before async logic)
            db.commit()

            # 🔁 Optional: Refresh ride/vehicle objects if needed
            db.refresh(ride)
            if vehicle:
                db.refresh(vehicle)

            # ✅ Notify other systems after commit
            await sio.emit("ride_status_updated", {
                "ride_id": str(ride.id),
                "new_status": ride.status.value
            })

            if vehicle:
                await sio.emit("vehicle_status_updated", {
                    "id": str(vehicle.id),
                    "status": vehicle.status.value
                })

            # ✅ VERY IMPORTANT: Call the async notification
            await notify_ride_cancelled_due_to_no_show(ride.id)

    except Exception as e:
        db.rollback()
    finally:
        db.close()

async def check_and_notify_overdue_rides():
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        overdue_rides = db.query(Ride, Vehicle, User).join(
            Vehicle, Ride.vehicle_id == Vehicle.id
        ).join(
            User, Ride.user_id == User.employee_id
        ).filter(
            (Ride.status == RideStatus.in_progress or Ride.status == RideStatus.cancelled_due_to_no_show) ,
            Ride.end_datetime <= datetime.now() - timedelta(hours=2)
        ).all()
        for ride, vehicle, user in overdue_rides:
            ride_end = ride.end_datetime
            if ride_end.tzinfo is None:
                ride_end = ride_end.replace(tzinfo=timezone.utc)

            elapsed = (now - ride_end).days

            # -- Send to user (passenger) --
            exists_user_notif = db.query(Notification).filter(
                Notification.user_id == user.employee_id,
                Notification.vehicle_id == vehicle.id,
                Notification.title == "Vehicle Overdue"
            ).first()

            if not exists_user_notif:
                user_notif = create_system_notification(
                    user_id=user.employee_id,
                    title="Vehicle Overdue",
                    message=f"הרכב {vehicle.plate_number} לא הוחזר בזמן.",
                    vehicle_id=vehicle.id
                )

                html_user = load_email_template("vehicle_overdue_user.html", {
                    "USER_NAME": get_user_name(db, user.employee_id),
                    "VEHICLE": vehicle.plate_number,
                    "END_TIME": ride.end_datetime.strftime("%H:%M %d/%m/%Y"),
                    "ELAPSED": str(elapsed).split('.')[0]
                })

                await async_send_email(
                    to_email=user.email,
                    subject=f"⚠️ החזרת רכב באיחור - {vehicle.plate_number}",
                    html_content=html_user
                )

                await sio.emit("new_notification", {
                    "id": str(user_notif.id),
                    "user_id": str(user_notif.user_id),
                    "title": user_notif.title,
                    "message": user_notif.message,
                    "notification_type": user_notif.notification_type.value,
                    "sent_at": user_notif.sent_at.isoformat(),
                    "vehicle_id": str(vehicle.id),
                    "plate_number": vehicle.plate_number
                }, room=str(user.employee_id))

            # -- Send to admins --
            admins = db.query(User).filter(User.role == "admin").all()
            for admin in admins:
                exists_admin = db.query(Notification).filter(
                    Notification.user_id == admin.employee_id,
                    Notification.vehicle_id == vehicle.id,
                    Notification.title == "Overdue Vehicle Alert"
                ).first()

                if not exists_admin:
                    admin_notif = create_system_notification(
                        user_id=admin.employee_id,
                        title="Overdue Vehicle Alert",
                        message=f"הרכב {vehicle.plate_number} לא הוחזר בזמן ע\"י {user.first_name} {user.last_name}.",
                        vehicle_id=vehicle.id
                    )

                    html_admin = load_email_template("vehicle_overdue_admin.html", {
                        "USER_NAME": f"{user.first_name} {user.last_name}",
                        "USER_EMAIL": user.email,
                        "VEHICLE": vehicle.plate_number,
                        "END_TIME": ride.end_datetime.strftime("%H:%M %d/%m/%Y"),
                        "ELAPSED": str(elapsed).split('.')[0]
                    })

                    await async_send_email(
                        to_email=admin.email,
                        subject=f"🚨 רכב לא הוחזר בזמן - {vehicle.plate_number}",
                        html_content=html_admin
                    )

                    await sio.emit("new_notification", {
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
            return


        for vehicle in vehicles_to_delete:
           
            notifications_to_delete = db.query(Notification).filter(
                Notification.vehicle_id == vehicle.id
            ).all()
            if notifications_to_delete:
                for notification in notifications_to_delete:
                    db.delete(notification)
          

            rides_to_delete = db.query(Ride).filter(
                Ride.vehicle_id == vehicle.id
            ).all()
            if rides_to_delete:
                for ride in rides_to_delete:
                    db.delete(ride)
           

            
            monthly_usage_to_delete = db.query(MonthlyVehicleUsage).filter(
                MonthlyVehicleUsage.vehicle_id == vehicle.id
            ).all()
            if monthly_usage_to_delete:
                for usage in monthly_usage_to_delete:
                    db.delete(usage)
          

            # Delete related Audit Logs (tbl: audit_logs, col: entity_id)
            audit_logs_to_delete = db.query(AuditLog).filter(
                # Use and_ to combine multiple conditions properly
                and_(
                    cast(AuditLog.entity_id, UUID) == vehicle.id,
                    AuditLog.entity_type == 'Vehicle'
                )
            ).all()
            if audit_logs_to_delete:
                for log in audit_logs_to_delete:
                    db.delete(log)
            

           
            db.delete(vehicle)

        db.commit()

    except Exception as e:
        db.rollback()
    finally:
        db.close()
        
            
async def notify_ride_needs_feedback(user_id: int):
    db = SessionLocal()
    try:
        ride = get_ride_needing_feedback(db, user_id)
        if ride is None:
            return {"needs_feedback": False}


        await sio.emit("feedback_needed", {
            "showPage": True,
            "ride_id": str(ride.id),
            "message": "הנסיעה הסתיימה, נא למלא את הטופס"
        })

    finally:
        db.close()

import asyncio

def periodic_check_overdue_rides():
    future = asyncio.run_coroutine_threadsafe(
        check_and_notify_overdue_rides(),
        main_loop  # use your app's asyncio event loop
    )
    try:
        future.result(timeout=10)
    except Exception as e:
        print(f"Overdue rides check failed: {e}")


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
        except Exception as e:
            print('Coroutine error:', e)



async def check_and_unblock_expired_users():
    """
    Unblock users whose block has expired, then emit a socket event per user.
    """
    db: Session = SessionLocal()
    users_to_notify = []  # collect AFTER commit we will emit

    try:
        now = datetime.now(timezone.utc)

        # Find users whose block has expired
        expired_blocks = db.query(User).filter(
            User.is_blocked == True,
            User.block_expires_at.isnot(None),
            User.block_expires_at < now
        ).all()

        if not expired_blocks:
            return  # nothing to do

        # Update users
        for user in expired_blocks:
            user.is_blocked = False
            user.block_expires_at = None
            # keep only scalar data for emission to avoid detached ORM issues
            users_to_notify.append({
                "id": str(user.employee_id),   # or str(user.id) if that's your primary
                "is_blocked": False,
                "block_expires_at": None
            })

        db.commit()

    except Exception as e:
        db.rollback()
        return
    finally:
        db.close()

    # Emit AFTER commit (so clients reflect DB state)
    for payload in users_to_notify:
        try:
            # If you want to target a room per user (recommended), pass room=str(employee_id)
            await sio.emit(
                'user_block_status_updated',
                {
                    "id": payload["id"],
                    "is_blocked": payload["is_blocked"],
                    "block_expires_at": payload["block_expires_at"]
                },
            )

        except Exception as e:
            print(f"Failed to emit for user:{e}")



def periodic_check_unblock_users():
    future = asyncio.run_coroutine_threadsafe(check_and_unblock_expired_users(), main_loop)
    try:
        future.result(timeout=10)
    except Exception as e:
        print(f"❌ Failed periodic_check_unblock_users: {e}")


def periodic_check_unstarted_rides(): 
    future = asyncio.run_coroutine_threadsafe(check_and_cancel_unstarted_rides(), main_loop)
    future.result(timeout=5)            


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
    finally:
        db.close()

scheduler.add_job(check_and_schedule_ride_emails, 'interval', minutes=60)
scheduler.add_job(check_and_complete_rides, 'interval', minutes=5)
scheduler.add_job(periodic_check_overdue_rides, 'interval', minutes=10)
scheduler.add_job(periodic_check_unblock_users, 'interval', minutes=1)


def notify_admins_daily():

    db = SessionLocal()
    try:
        admins = db.query(User).filter(User.role == "admin").all()
        for admin in admins:
            create_system_notification(
                user_id=admin.employee_id,
                title="📋 תזכורת יומית",
                message="אנא בדוק את כל בדיקות הרכב שבוצעו היום."
            )
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
            return


        for ride in rides_to_notify:
            user = db.query(User).filter(User.employee_id == ride.user_id).first()
            if not user:
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

                await emit_new_notification(
                    notification=notification,
                    room=str(user.employee_id),
                )

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
                    except Exception as email_e:
                        print(f"Error sending email:{repr(email_e)}")
               
    except Exception as e:
        print(f"An error occurred: {repr(e)}")
    finally:
        db.close()


async def notify_ride_cancelled_due_to_no_show(ride_id: uuid.UUID):

    """
    Notifies user and admin that a ride was cancelled due to no-show.
    """
    db: Session = SessionLocal()
    try:
        
        ride = db.query(Ride).filter(Ride.id == ride_id).first()
        if not ride:
            return

        user = db.query(User).filter(User.employee_id == ride.user_id).first()
        if not user:
            return

        user_email = user.email
        user_name = get_user_name(db, user.employee_id) or "משתמש יקר"

        destination_name = str(ride.stop)
        if ride.stop:
            city = db.query(City).filter(City.id == ride.stop).first()
            if city:
                destination_name = city.name

        plate_number = "לא הוקצה רכב"
        if ride.vehicle_id:
            vehicle = db.query(Vehicle).filter(Vehicle.id == ride.vehicle_id).first()
            if vehicle:
                plate_number = vehicle.plate_number
                

        notif_message = f"הנסיעה שלך ליעד {destination_name} בוטלה עקב אי התייצבות."
        notification = create_system_notification(
            user_id=user.employee_id,
            title="עדכון: הנסיעה בוטלה עקב אי התייצבות",
            message=notif_message,
            order_id=ride.id
        )
        await emit_new_notification(
            notification=notification
        )

        supervisor_id=get_supervisor_id(user_id=user.employee_id,db=db)
        if supervisor_id:
            user_name_safe = user_name or "משתמש לא ידוע"
            destination_safe = destination_name or "יעד לא ידוע"

            # Create notification for supervisor
            supervisor_notification = create_system_notification(
                user_id=supervisor_id,
                title="הודעה: הנסיעה בוטלה עקב אי התייצבות",
                message=f"הנסיעה של {user_name_safe} ליעד {destination_safe} בוטלה עקב אי התייצבות.",
                order_id=ride.id
            )

            # Emit notification to frontend
            await emit_new_notification(notification=supervisor_notification)
            
        # 🟢 2. Send notification to admin
        admins = db.query(User).filter(User.role == "admin").all()
        for admin in admins:
            admin_id = admin.employee_id
            if not admin_id:
                continue
            admin_notification = create_system_notification(
                user_id=admin_id,
                title=f"הודעה: הנסיעה בוטלה עקב אי התייצבות",
                message=f"הנסיעה של {user_name} ליעד {destination_name} בוטלה עקב אי התייצבות.",
                order_id=ride.id
            )
            await emit_new_notification(
                notification=admin_notification
            )

        if user_email:
            html_content_user = load_email_template("ride_cancelled_no_show.html", {
                "USER_NAME": user_name,
                "DESTINATION": destination_name,
                "DATE_TIME": ride.start_datetime.strftime("%Y-%m-%d %H:%M"),
                "PLATE_NUMBER": plate_number,
                "LINK_TO_RIDE": f"{BOOKIT_URL}/ride/details/{ride.id}"
            })

            await async_send_email(
                to_email=user_email,
                subject=f"❌ עדכון: הנסיעה שלך בוטלה עקב אי התייצבות",
                html_content=html_content_user
            )
       

        
        admin_users = db.query(User).filter(User.role == "admin").all()

        if admin_users:
            for admin_user in admin_users:
                admin_email = admin_user.email
                supervisor_name = get_user_name(db, admin_user.employee_id) or "מפקח יקר" 

                if admin_email: # Check if the admin user actually has an email
                    try:
                        html_content_admin = load_email_template("ride_cancelled_no_show_admin.html", {
                            "SUPERVISOR_NAME": supervisor_name, 
                            "USER_NAME": user_name,
                            "DESTINATION": destination_name,
                            "DATE_TIME": ride.start_datetime.strftime("%Y-%m-%d %H:%M"),
                            "PLATE_NUMBER": plate_number,
                            "LINK_TO_RIDE": f"{BOOKIT_URL}/ride/details/{ride.id}"
                        })
                        await async_send_email(
                            to_email=admin_email,
                            subject=f"🚨 הודעה: הנסיעה של {user_name} בוטלה עקב אי התייצבות",
                            html_content=html_content_admin
                        )
                    except Exception as email_err:
                        print(f"ERROR: Failed to send admin email:{repr(email_err)}")
        try:
            if supervisor_id:
                supervisor = db.query(User).filter(User.employee_id == supervisor_id).first()
                if supervisor and supervisor.email:
                    supervisor_email = supervisor.email
                    supervisor_name = get_user_name(db, supervisor_id) or "מפקח יקר"

                    html_content_supervisor = load_email_template("ride_cancelled_no_show_admin.html", {
                        "SUPERVISOR_NAME": supervisor_name,
                        "USER_NAME": user_name,
                        "DESTINATION": destination_name,
                        "DATE_TIME": ride.start_datetime.strftime("%Y-%m-%d %H:%M"),
                        "PLATE_NUMBER": plate_number,
                        "LINK_TO_RIDE": f"{BOOKIT_URL}/ride/details/{ride.id}"
                    })

                    await async_send_email(
                        to_email=supervisor_email,
                        subject=f"🚨 הודעה: הנסיעה של {user_name} בוטלה עקב אי התייצבות",
                        html_content=html_content_supervisor

                    )

        except Exception as e:
            print(f"ERROR: Failed to send email: {repr(e)}")    
    except Exception as e:
        print(f"Error notifying: {repr(e)}")
      
    finally:
        db.commit()
        db.close()


async def check_and_notify_admin_about_no_shows():
    db: Session = SessionLocal()
    try:
        data = get_no_show_events_count_per_user(db)
        for user_info in data["users"]:
            if user_info["no_show_count"] >= 3:
                title = f"המשתמש {user_info['name']} פספס {user_info['no_show_count']} נסיעות"

                existing = db.query(Notification).filter(
                    Notification.title == title,
                    Notification.relevant_user_id == user_info["employee_id"]
                ).first()

                if not existing:
                    # Create system notification for all admins
                    admins = db.query(User).filter(User.role == "admin").all()
                    for admin in admins:
                        admin_id = admin.employee_id
                        if not admin_id:
                            continue

                        notif = create_system_notification(
                            user_id=admin_id,
                            title=title,
                            message=f"המשתמש {user_info['name']} פספס {user_info['no_show_count']} נסיעות.",
                            relevant_user_id=user_info["employee_id"]
                        )
                        await emit_new_notification(notification=notif)

                    for admin in admins:
                        admin_email = admin.email
                        supervisor_name = get_user_name(db, admin.employee_id) or "מפקח יקר"
                        if admin_email:
                            try:
                                html_content_admin = load_email_template("users_passed_3_no_show.html", {
                                    "SUPERVISOR_NAME": supervisor_name,
                                    "USER_NAME": user_info["name"],
                                    "NO_SHOW_COUNT": user_info["no_show_count"],
                                })
                                await async_send_email(
                                    to_email=admin_email,
                                    subject=f"🚨 משתמש עם 3 או יותר אי התייצבויות: {user_info['name']}",
                                    html_content=html_content_admin
                                )
                            except Exception as email_err:
                                print(f"ERROR: Failed to send 3+ no-show email")
                        
                    db.commit()

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
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
    future = asyncio.run_coroutine_threadsafe(check_inactive_vehicles(), main_loop)
    future = asyncio.run_coroutine_threadsafe(check_vehicle_lease_expiry(), main_loop)
    future.result(timeout=5)

def periodic_check_ride_status():
    future_ride_status = asyncio.run_coroutine_threadsafe(check_ride_status_and_notify_user(), main_loop)
    try:
        future_ride_status.result(timeout=5)
    except Exception as e:
        print(f"Error running check_ride_status_and_notify_user: {e}")


def periodic_check_no_show_users():
    future = asyncio.run_coroutine_threadsafe(check_and_notify_admin_about_no_shows(), main_loop)
    try:
        future.result(timeout=30)
    except Exception as e:
        print(f"Error running periodic_check_no_show_users: {e}")

 
def periodic_check_inspector_notif():
    future = asyncio.run_coroutine_threadsafe(send_notif_to_inspector(), main_loop)
    try:
        future.result(timeout=30)
    except Exception as e:
        print(f"Error running periodic_check_no_show_users: {e}")

  

def periodic_delete_archived_vehicles():
    future = asyncio.run_coroutine_threadsafe(delete_old_archived_vehicles(), main_loop)
    try:
        future.result(timeout=60) # Increased timeout to 60 seconds
    except Exception as e:
        print(f"Error running delete_old_archived_vehicles: {e}")       



scheduler.add_job(periodic_check_vehicle, 'interval', days=1)

scheduler.add_job(
    periodic_check_inspector_notif,
    trigger='cron',
    hour=6,
    minute=0
)

scheduler.add_job(periodic_check_no_show_users, 'interval', minutes=15)
scheduler.add_job(periodic_check_ride_status, 'interval', minutes=15)
scheduler.add_job(periodic_delete_archived_vehicles, 'interval',  days=30)
scheduler.add_job(periodic_check_unstarted_rides, 'interval', minutes=1)


scheduler.start()



def start_scheduler():
    scheduler.add_job(notify_admins_daily, 'cron', hour=6, minute=0)
    scheduler.start()



        
def start_scheduler():
    scheduler = BackgroundScheduler(timezone=pytz.timezone("Asia/Jerusalem"))
    scheduler.add_job(notify_admins_daily, 'cron', hour=6, minute=0)
    scheduler.start()

async def check_expired_government_licenses():
    db: Session = SessionLocal()
    today = date.today()

    try:
        # שלוף משתמשים שהרישיון שלהם פג תוקף או שאין להם תאריך תפוגה, אבל עדיין מסומנים כאילו יש להם רישיון
        users_with_expired_license = db.query(User).filter(
            User.has_government_license == True,
            or_(
                User.license_expiry_date == None,
                User.license_expiry_date < today
            )
        ).all()

        print(f"Users with expired license count: {len(users_with_expired_license)}")

        if not users_with_expired_license:
            print("No expired licenses found. Exiting.")
            return

        # עדכן את השדה has_government_license
        for user in users_with_expired_license:
            print(f"Updating user {user.employee_id} - setting has_government_license to False")
            user.has_government_license = False

        db.commit()
        print("Committed license updates to DB")

        # שלח התראות לאדמין על כל משתמש שרישיונו לא בתוקף
        admins = db.query(User).filter(User.role == "admin").all()

        for user in users_with_expired_license:
            full_name = f"{user.first_name} {user.last_name}"
            expiry = user.license_expiry_date.strftime("%d/%m/%Y") if user.license_expiry_date else "לא הוזן"

            print(f"Processing user: {full_name} (ID: {user.employee_id})")
            print(f"User email: {user.email}")
            print(f"License expiry: {expiry}")

            # בדיקת תקינות המייל לפני שליחה למשתמש
            if user.email and "@" in user.email and "." in user.email:
                try:
                    # שלח מייל למשתמש עצמו
                    user_html_content = f"""
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <title>רישיון ממשלתי פג תוקף</title>
                    </head>
                    <body>
                        <div style="direction: rtl; font-family: Arial, sans-serif;">
                            <h2>שלום {user.first_name},</h2>
                            <p>רישיון הממשלתי שלך פג תוקף בתאריך: <strong>{expiry}</strong>.</p>
                            <p>אנא עדכן את המידע בהקדם.</p>
                            <br/>
                            <p>תודה,<br/>צוות התמיכה</p>
                        </div>
                    </body>
                    </html>
                    """

                    print(f"Sending email to user: {user.email}")
                    await async_send_email(
                        to_email=user.email,
                        subject="רישיון ממשלתי פג תוקף",
                        html_content=user_html_content
                    )
                    print(f"✅ Email sent successfully to user {user.employee_id}")

                    # שלח התראה למשתמש
                    user_notif = create_system_notification(
                        user_id=user.employee_id,
                        title="רישיון ממשלתי פג תוקף",
                        message=f"הרישיון הממשלתי שלך פג תוקף (תוקף עד {expiry}). אנא חדש את הרישיון במהרה.",
                        relevant_user_id=user.employee_id
                    )

                    await sio.emit("license_expiry_notification", {
                        "id": str(user_notif.id),
                        "user_id": str(user_notif.user_id),
                        "title": user_notif.title,
                        "message": user_notif.message,
                        "notification_type": user_notif.notification_type.value,
                        "sent_at": user_notif.sent_at.isoformat(),
                        "relevant_user_id": str(user.employee_id)
                    }, room=str(user.employee_id))
                    
                    print(f"✅ Socket notification sent to user {user.employee_id}")

                except Exception as e:
                    print(f"❌ Error sending email to user {user.employee_id}: {str(e)}")
                    # המשך לאדמינים גם אם שליחה למשתמש נכשלה
            else:
                print(f"⚠️ Invalid email for user {user.employee_id}: {user.email}")

            # שלח התראות לאדמינים
            for admin in admins:
                try:
                    # בדיקה אם כבר קיימת התראה
                    exists = db.query(Notification).filter(
                        Notification.user_id == admin.employee_id,
                        Notification.title == "רישיון ממשלתי לא בתוקף",
                        Notification.relevant_user_id == user.employee_id
                    ).first()
                    

                    if exists:
                        print(f"Notification already exists for admin {admin.employee_id} and user {user.employee_id}")
                        continue

                    notif = create_system_notification(
                        user_id=admin.employee_id,
                        title="רישיון ממשלתי לא בתוקף",
                        message=f"למשתמש {full_name} אין רישיון ממשלתי בתוקף (תוקף עד {expiry}).",
                        relevant_user_id=user.employee_id
                    )

                    admin_email = get_user_email(admin.employee_id, db)
                    print(f"Admin email: {admin_email}")
                    
                    if admin_email and "@" in admin_email and "." in admin_email:
                        admin_html_content = f"""
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="UTF-8">
                            <title>רישיון ממשלתי לא בתוקף</title>
                        </head>
                        <body>
                            <div style="direction: rtl; font-family: Arial, sans-serif;">
                                <h2>שלום {get_user_name(db, admin.employee_id)},</h2>
                                <p>למשתמש <strong>{full_name}</strong> פג תוקף הרישיון הממשלתי בתאריך: <strong>{expiry}</strong>.</p>
                                <p>מזהה משתמש: {user.employee_id}</p>
                                <p>אנא בדק ועקוב אחר עדכון הרישיון.</p>
                                <br/>
                                <p>בברכה,<br/>מערכת ניהול רישיונות</p>
                            </div>
                        </body>
                        </html>
                        """

                        print(f"Sending email to admin: {admin_email}")
                        await async_send_email(
                            to_email=admin_email,
                            subject=f"רישיון ממשלתי לא בתוקף - {full_name}",
                            html_content=admin_html_content
                        )
                        print(f"✅ Email sent successfully to admin {admin.employee_id}")
                    else:
                        print(f"⚠️ Invalid admin email: {admin_email}")

                    await sio.emit("license_expiry_notification", {
                        "id": str(notif.id),
                        "user_id": str(notif.user_id),
                        "title": notif.title,
                        "message": notif.message,
                        "notification_type": notif.notification_type.value,
                        "sent_at": notif.sent_at.isoformat(),
                        "relevant_user_id": str(user.employee_id)
                    }, room=str(admin.employee_id))
                    
                    print(f"✅ Socket notification sent to admin {admin.employee_id}")

                except Exception as e:
                    print(f"❌ Error processing admin {admin.employee_id}: {str(e)}")
                    continue  # המשך לאדמין הבא

    except Exception as e:
        db.rollback()
        print(f"❌ Error in check_expired_government_licenses: {e}")
        import traceback
        print(f"Full traceback: {traceback.format_exc()}")

    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(check_expired_government_licenses())
