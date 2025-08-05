from src.utils.database import SessionLocal
from src.models.ride_model import Ride
from src.models.user_model import User
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
from ..utils.email_utils import send_email

def send_ride_completion_email(ride_id: str):
    db = SessionLocal()
    try:
        ride = db.query(Ride).filter(Ride.id == ride_id).first()
        if not ride:
            return

        user = db.query(User).filter(User.employee_id == ride.user_id).first()
        if not user:
            return

        form_link = f"https://localhost:8000/ride-completion-form/{ride.id}"  # Frontend route

        subject = "טופס חווית נסיעה - נא למלא"
        body = (
            f"שלום {user.first_name},\n\n"
            f"בקשתך לנסיעה הסתיימה. אנא מלא את טופס חווית הנסיעה בקישור הבא:\n{form_link}\n\n"
            "תודה!"
        )

        send_email(subject=subject, body=body, recipients=[user.email])

    finally:
        db.close()



scheduler = BackgroundScheduler()
scheduler.start()

