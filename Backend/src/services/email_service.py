import os
import ssl
import certifi
import asyncio
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from uuid import UUID
from jinja2 import Environment, FileSystemLoader, select_autoescape
from src.models.user_model import User

# טוען משתני סביבה
load_dotenv()

# הגדרת נתיב תעודת SSL לסביבת הריצה
os.environ['SSL_CERT_FILE'] = certifi.where()

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
EMAIL_FROM = os.getenv("EMAIL_FROM")

# הגדרת סביבה לטעינת תבניות Jinja2 מתוך התיקיה src/templates/emails
env = Environment(
    loader=FileSystemLoader("src/templates/emails"),
    autoescape=select_autoescape(['html', 'xml']),
)


def render_email_template(template_name: str, context: dict) -> str:
    """
    טוען ומעבד תבנית HTML עם משתנים.
    """
    template = env.get_template(template_name)
    return template.render(**context)


def send_email(to_email: str, subject: str, html_content: str, text_content: str = ""):
    """
    שליחת מייל סינכרונית דרך SendGrid.
    """
    message = Mail(
        from_email=EMAIL_FROM,
        to_emails=to_email,
        subject=subject,
        html_content=html_content,
        plain_text_content=text_content or html_content,
    )

    try:
        # --- DEBUGGING ADDITION START ---
        if not SENDGRID_API_KEY:
            print("DEBUG: SENDGRID_API_KEY is not loaded from .env. Check your .env file path and variable name.")
            raise ValueError("SENDGRID_API_KEY is missing.")
        else:
            # Print a masked version of the key to confirm it's loaded without exposing it fully
            masked_key = f"{SENDGRID_API_KEY[:5]}...{SENDGRID_API_KEY[-5:]}"
            print(f"DEBUG: Using SendGrid API Key (masked): {masked_key}")
        # --- DEBUGGING ADDITION END ---
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        print(f"✅ Email sent: {response.status_code}")
        print(f"📩 Response body: {response.body}")
        print(f"📨 Response headers: {response.headers}")
        return response
    except Exception as e:
        print(f"❌ Error sending email: {e}")
        # כאן ניתן להחליט האם לזרוק או לא את החריגה
        raise


async def async_send_email(to_email: str, subject: str, html_content: str, text_content: str = ""):
    print('in send email sending')
    """
    שליחה אסינכרונית (לא חוסמת) של מייל דרך SendGrid.
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, send_email, to_email, subject, html_content, text_content)
def load_email_template(template_name: str, context: dict) -> str:
    template_path = os.path.join("src", "templates", "emails", template_name)
    with open(template_path, "r", encoding="utf-8") as file:
        content = file.read()

    for key, value in context.items():
        content = content.replace(f"{{{{{key}}}}}", str(value))
    return content

def get_user_email(user_id: UUID, db: Session) -> str | None:
    """
    מחזיר את כתובת המייל של המשתמש לפי ה-UUID שלו, או None אם לא קיים.
    """
    user = db.query(User).filter(User.employee_id == user_id).first()
    if user and user.email:
        return user.email
    return None
