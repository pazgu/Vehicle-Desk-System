import asyncio
from ..services.user_form import get_ride_needing_feedback
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, time, timezone
from src.utils.database import SessionLocal
from src.models.user_model import User
from ..models.ride_model import Ride, RideStatus
from src.services.user_notification import create_system_notification
import pytz
from apscheduler.jobstores.base import JobLookupError
from datetime import datetime, timedelta
from ..services.form_email import send_ride_completion_email
from ..services.supervisor_dashboard_service import start_ride 

from ..utils.socket_manager import sio
scheduler = BackgroundScheduler(timezone=pytz.timezone("Asia/Jerusalem"))


main_loop = asyncio.get_event_loop()

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
        res=await start_ride(db, ride_id)
        ride=res[0]
        vehicle=res[1]
         # 3️⃣ Emit ride update
        await sio.emit("ride_status_updated", {
            "ride_id": str(ride.id),
            "new_status": ride.status.value
        })
        # 4️⃣ Emit vehicle update
        await sio.emit("vehicle_status_updated", {
            "id": str(vehicle.id),
            "status": vehicle.status.value
        })
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

scheduler.add_job(periodic_check, 'interval', seconds=60)

scheduler.start()
        
def start_scheduler():
    scheduler = BackgroundScheduler(timezone=pytz.timezone("Asia/Jerusalem"))
    scheduler.add_job(notify_admins_daily, 'cron', hour=6, minute=0)
    scheduler.start()
