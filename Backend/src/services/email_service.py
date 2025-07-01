import os
import ssl
import certifi
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from dotenv import load_dotenv


load_dotenv()

os.environ['SSL_CERT_FILE'] = certifi.where()

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
EMAIL_FROM = os.getenv("EMAIL_FROM")


def send_email(to_email: str, subject: str, html_content: str, text_content: str = ""):
    message = Mail(
        from_email=EMAIL_FROM,
        to_emails=to_email,
        subject=subject,
        html_content=html_content,
        plain_text_content=text_content or html_content,
    )

    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        print(f"✅ Email sent: {response.status_code}")
        return response
    except Exception as e:
        print(f"❌ Error sending email: {e}")
        raise