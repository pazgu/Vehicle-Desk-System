import asyncio
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, time, timezone
from src.utils.database import SessionLocal
from src.models.user_model import User
from ..models.ride_model import Ride
from src.services.user_notification import create_system_notification
import pytz
from apscheduler.jobstores.base import JobLookupError
from datetime import datetime, timedelta
from ..services.form_email import send_ride_completion_email
from ..services.supervisor_dashboard_service import start_ride 

scheduler = BackgroundScheduler(timezone=pytz.timezone("Asia/Jerusalem"))
scheduler.start()


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
        await start_ride(db, ride_id)
    finally:
        db.close()




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

def start_scheduler():
    scheduler = BackgroundScheduler(timezone=pytz.timezone("Asia/Jerusalem"))
    scheduler.add_job(notify_admins_daily, 'cron', hour=6, minute=0)
    scheduler.start()
