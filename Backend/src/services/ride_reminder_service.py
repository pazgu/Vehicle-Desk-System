import asyncio
import logging
import os
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from uuid import UUID

from src.models.ride_model import Ride
from src.models.user_model import User
from src.models.city_model import City
from src.models.vehicle_model import Vehicle
from src.utils.database import SessionLocal
from src.utils.scheduler import scheduler


logger = logging.getLogger(__name__)

BOOKIT_FRONTEND_URL = os.getenv("BOOKIT_FRONTEND_URL", "http://localhost:4200")

def schedule_ride_reminder_email(ride_id: UUID, scheduled_start_time: datetime):
    """
    Schedules a ride reminder email to be sent 24 hours before the ride starts.
    """
    # Calculate the reminder time (24 hours before start)
    reminder_time = scheduled_start_time - timedelta(hours=24)

    # Ensure the reminder is scheduled for a future time
    if reminder_time <= datetime.now():
        logger.warning(f"Ride {ride_id} is too close to its start time ({scheduled_start_time}) "
                       f"to schedule a 24-hour reminder. Sending immediately instead.")
        # If the ride is less than 24 hours away, send the reminder immediately
        # In a real-world scenario, you might want different logic here (e.g., skip, or send next available reminder)
        send_ride_reminder(str(ride_id))
        return

    job_id = f"ride-reminder-{ride_id}"
    try:
        scheduler.add_job(
            send_ride_reminder,
            'date',
            run_date=reminder_time,
            args=[str(ride_id)],
            id=job_id,
            replace_existing=True # Useful if ride start time is updated
        )
        logger.info(f"✅ Scheduled ride reminder email for ride {ride_id} at {reminder_time}")
    except Exception as e:
        logger.error(f"❌ Error scheduling ride reminder for {ride_id}: {e}")


def send_ride_reminder(ride_id: str):
    """
    Fetches ride details and sends the reminder email.
    This function will be executed by the APScheduler.
    """
    db = SessionLocal()
    try:
        ride = db.query(Ride).filter(Ride.id == UUID(ride_id)).first()
        if not ride:
            logger.warning(f"Ride with ID {ride_id} not found for reminder email.")
            return

        user = db.query(User).filter(User.employee_id == ride.user_id).first()
        if not user or not user.email:
            logger.warning(f"User or user email not found for ride {ride_id}. Skipping reminder.")
            return

        # Get city names
        destination_city = db.query(City).filter(City.id == ride.stop).first()
        destination_name = destination_city.name if destination_city else "Unknown Destination"

        from_city_name = os.getenv("FROM_CITY_NAME", "Unknown City") # Assuming FROM_CITY_NAME is available in .env

        # Get vehicle plate number
        vehicle_plate = "לא נבחר"
        if ride.vehicle_id:
            vehicle = db.query(Vehicle).filter(Vehicle.id == ride.vehicle_id).first()
            if vehicle:
                vehicle_plate = vehicle.plate_number


        # # Load email template and fill context
        # html_content = load_email_template("ride_reminder.html", {
        #     "PASSENGER_NAME": user.first_name,
        #     "FROM_CITY": from_city_name,
        #     "DESTINATION": destination_name,
        #     "DATE_TIME": ride.start_datetime.strftime("%Y-%m-%d %H:%M"), # Format as needed
        #     "PLATE_NUMBER": vehicle_plate,
        #     "DISTANCE": f"{ride.estimated_distance_km:.1f}" if ride.estimated_distance_km is not None else "לא ידוע",
        #     "LINK_TO_ORDER": f"{BOOKIT_FRONTEND_URL}/ride/details/{ride.id}" # Adjust frontend route as needed
        # })

        # # Send the email asynchronously
        # asyncio.run(async_send_email(
        #     to_email=user.email,
        #     subject="⏰ תזכורת: נסיעתך מתוכננת בקרוב!",
        #     html_content=html_content
        # ))
        logger.info(f"📧 Ride reminder email sent to {user.email} for ride {ride.id}")

    except Exception as e:
        logger.error(f"❌ Error sending ride reminder email for ride {ride_id}: {e}", exc_info=True)
    finally:
        db.close()