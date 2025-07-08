import asyncio
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List
from dotenv import load_dotenv
import os
from pathlib import Path


load_dotenv()

SMTP_SERVER = os.getenv("SMTP_SERVER")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))  
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
EMAIL_FROM = os.getenv("EMAIL_FROM")


def send_email(subject: str, body: str, recipients: List[str]):
    msg = MIMEMultipart()
    msg['From'] = f"Vehicle Desk <{EMAIL_FROM}>"
    msg['Reply-To'] = EMAIL_FROM
    msg['To'] = ", ".join(recipients)
    msg['Subject'] = subject
    msg.add_header("X-MJ-TemplateLanguage", "true")
    msg.add_header("X-MJ-TrackOpen", "1")
    msg.add_header("X-MJ-TrackClick", "1")



    msg.attach(MIMEText(body, 'html'))

    print(f"📧 Sending email to {recipients}")

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(EMAIL_FROM, recipients, msg.as_string())
        print(f"✅ Email successfully sent to {recipients}")
    except Exception as e:
        print(f"❌ Failed to send email to {recipients}: {e}")


def load_email_template(template_name: str) -> str:
    """
    Load an HTML email template from the templates/email/ directory.
    """
    base_path = Path(__file__).resolve().parent.parent
    template_path = base_path / "templates" / "emails" / template_name

    if not template_path.exists():
        raise FileNotFoundError(f"Email template not found: {template_path}")

    return template_path.read_text(encoding="utf-8")

# async def async_send_email(subject: str, body: str, recipients: List[str]):
#     """
#     Runs the synchronous send_email function in a separate thread 
#     to avoid blocking the main asyncio event loop.
#     """
#     loop = asyncio.get_running_loop()
#     await loop.run_in_executor(
#         None,  # Uses the default thread pool executor
#         send_email,
#         subject,
#         body,
#         recipients
#     )
