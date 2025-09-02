from ..models.ride_model import Ride
from ..models.user_model import User

from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime

from ..utils.email_utils import send_email
from ..utils.database import SessionLocal

def send_ride_completion_email(ride_id: str):
    db = SessionLocal()
    try:
        ride = db.query(Ride).filter(Ride.id == ride_id).first()
        if not ride:
            print(f"❌ Ride with ID {ride_id} not found.")
            return

        user = db.query(User).filter(User.employee_id == ride.user_id).first()
        if not user:
            print(f"❌ User for ride ID {ride_id} not found.")
            return

        form_link = f"https://localhost:8000/ride-completion-form/{ride.id}"  # Frontend route

        subject = "טופס חווית נסיעה - נא למלא"
        body = (
            f"שלום {user.first_name},\n\n"
            f"בקשתך לנסיעה הסתיימה. אנא מלא את טופס חווית הנסיעה בקישור הבא:\n{form_link}\n\n"
            "תודה!"
        )

        send_email(subject=subject, body=body, recipients=[user.email])
        print(f"📧 Email sent to {user.email} for ride {ride.id}")

    finally:
        db.close()



scheduler = BackgroundScheduler()
scheduler.start()

