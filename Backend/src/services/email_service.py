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
            raise ValueError("SENDGRID_API_KEY is missing.")
        else:
            masked_key = f"{SENDGRID_API_KEY[:5]}...{SENDGRID_API_KEY[-5:]}"
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        return response
    except:
        raise


async def async_send_email(to_email: str, subject: str, html_content: str, text_content: str = ""):
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, send_email, to_email, subject, html_content, text_content)
def load_email_template(template_name: str, context: dict) -> str:
    template_path = os.path.join("src", "templates", "emails", template_name)
    try:
        with open(template_path, "r", encoding="utf-8") as file:
            content = file.read()
        for key, value in context.items():
            old_content = content
            content = content.replace(f"{{{{ {key} }}}}", str(value))  # With spaces
            content = content.replace(f"{{{{{key}}}}}", str(value))    # Without spaces
                    
        return content
        
    except FileNotFoundError:
        return ""
    except Exception as e:
        return ""

def get_user_email(user_id: UUID, db: Session) -> str | None:
    user = db.query(User).filter(User.employee_id == user_id).first()
    if user and user.email:
        return user.email
    return None
