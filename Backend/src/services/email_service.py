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

        if 200 <= response.status_code < 300:
            print(f"✅ Email sent successfully with status: {response.status_code}")
            return True # <--- Return True for success
        else:
            print(f"❌ SendGrid returned an error status: {response.status_code}")
            return False # <--- Return False for a non-2xx status

    except Exception as e:
        #print(f"❌ Error sending email: {e}")
        # כאן ניתן להחליט האם לזרוק או לא את החריגה
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

async def send_license_expiry_notifications(user_id: UUID, db: Session):
    user = db.query(User).filter(User.employee_id == user_id).first()
    if not user or not user.email:
        print(f"No valid user or email found for user_id {user_id}")
        return

    admin_emails = get_admin_emails(db)
    if not admin_emails:
        print("No admin emails found")
        # חשוב: כדאי לא להחזיר return כאן, כי עדיין רוצים לשלוח למשתמש
        # return

    expiry_date = user.license_expiry_date.strftime("%d/%m/%Y") if user.license_expiry_date else "לא ידוע"
    
    # תוכן מייל למשתמש
    user_html_content = f"""
    <html>
      <body>
        <p>שלום {user.first_name},</p>
        <p>רישיון הממשלתי שלך פג תוקף בתאריך: <strong>{expiry_date}</strong>.</p>
        <p>אנא עדכן את המידע בהקדם.</p>
        <br/>
        <p>תודה,<br/>צוות התמיכה</p>
      </body>
    </html>
    """

    # תוכן מייל לאדמין (שונה מהמשתמש)
    admin_html_content = f"""
    <html>
      <body>
        <p>שלום,</p>
        <p>למשתמש <strong>{user.first_name} {user.last_name}</strong> פג תוקף הרישיון הממשלתי בתאריך: <strong>{expiry_date}</strong>.</p>
        <p>אנא בדק ועקוב אחר עדכון הרישיון.</p>
        <p>מזהה משתמש: {user.employee_id}</p>
        <br/>
        <p>בברכה,<br/>מערכת ניהול רישיונות</p>
      </body>
    </html>
    """

    user_subject = "רישיון ממשלתי פג תוקף"
    admin_subject = f"רישיון ממשלתי פג תוקף - {user.first_name} {user.last_name}"

    try:
        # שלח מייל למשתמש
        await async_send_email(user.email, user_subject, user_html_content)
        print(f"✅ Email sent to user {user.employee_id}")

        # שלח מייל לכל האדמינים (כל אחד בנפרד)
        for admin_email in admin_emails:
            await async_send_email(admin_email, admin_subject, admin_html_content)
            print(f"✅ Email sent to admin {admin_email}")

    except Exception as e:
        print(f"❌ Error sending emails for user {user_id}: {e}")
        # כדאי לשקול אם