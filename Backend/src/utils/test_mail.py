import smtplib
from email.mime.text import MIMEText

msg = MIMEText("This is a test email.")
msg["Subject"] = "Test Email from Mailjet"
msg["From"] = "sarahmansor2580@gmail.com"
msg["To"] = "salihkaren345@gmail.com"

with smtplib.SMTP("in-v3.mailjet.com", 587) as server:
    server.starttls()
    server.login("2bf522ff628a0e9c7f8c85218e8a8558", "a43f320023e4e345cf92ee8355fa1ca8")
    server.sendmail(msg["From"], [msg["To"]], msg.as_string())
