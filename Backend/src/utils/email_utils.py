import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List

SMTP_SERVER = "in-v3.mailjet.com"
SMTP_PORT = 587
SMTP_USERNAME = "2bf522ff628a0e9c7f8c85218e8a8558"
SMTP_PASSWORD = "a43f320023e4e345cf92ee8355fa1ca8"
EMAIL_FROM = "sarahmansor2580@gmail.com"


def send_email(subject: str, body: str, recipients: List[str]):
    msg = MIMEMultipart()
    msg['From'] = EMAIL_FROM
    msg['To'] = ", ".join(recipients)
    msg['Subject'] = subject

    msg.attach(MIMEText(body, 'plain'))

    with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.sendmail(EMAIL_FROM, recipients, msg.as_string())
