import asyncio
import os
import ssl
import certifi
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID
import socketio
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from sqlalchemy.orm import Session
from tenacity import retry, stop_after_attempt, wait_exponential, before_sleep_log
from typing_extensions import Annotated

# Utils
from ..utils.database import SessionLocal
from ..utils.socket_manager import sio as global_sio_instance

# Models
from ..models.ride_model import Ride
from ..models.user_model import User

# Schemas
from ..schemas.email_status_schema import EmailStatusEnum

load_dotenv()
os.environ['SSL_CERT_FILE'] = certifi.where()
logger = logging.getLogger(__name__)

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
EMAIL_FROM = os.getenv("EMAIL_FROM")

jinja_env = Environment(
    loader=FileSystemLoader("src/templates/emails"),
    autoescape=select_autoescape(['html', 'xml'])
)

def _send_email_sync_sendgrid(subject: str, html_content: str, to_emails: List[str], text_content: str = "") -> bool:
    """Synchronous email sending via SendGrid API."""
    message = Mail(
        from_email=EMAIL_FROM,
        to_emails=to_emails,
        subject=subject,
        html_content=html_content,
        plain_text_content=text_content or html_content,
    )
    try:
        if not SENDGRID_API_KEY:
            logger.error("SENDGRID_API_KEY is not loaded.")
            return False
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        if 200 <= response.status_code < 300:
            logger.info(f"✅ SendGrid Email sent successfully with status: {response.status_code}")
            return True
        else:
            error_details = response.body.decode('utf-8') if response.body else 'No error details provided.'
            logger.error(f"❌ SendGrid returned an error status: {response.status_code}. Details: {error_details}")
            return False
    except Exception as e:
        logger.error(f"❌ Error sending email via SendGrid: {e}", exc_info=True)
        return False

async def _async_send_email_sendgrid(subject: str, body: str, recipients: List[str]) -> bool:
    """Asynchronous SendGrid email sender."""
    # return False #TEMP: will make the email sending fail every time

    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None,
        _send_email_sync_sendgrid,
        subject,
        body,
        recipients,
        ""
    )

class EmailService:
    def __init__(self, sio_server: socketio.AsyncServer):
        self.sio_server = sio_server

    async def _get_user_email(self, user_id: UUID, db: Session) -> str | None:
        """Retrieves the email address of a user by their UUID."""
        user = db.query(User).filter(User.employee_id == user_id).first()
        if user and user.email:
            return user.email
        logger.warning(f"Email not found for user ID: {user_id}")
        return None

    async def _emit_email_status(self, user_id: UUID, email_type: str, status: EmailStatusEnum, message: str, identifier_id: UUID | None = None):
        """Emits an email status update via Socket.IO."""
        event_name = f"email_status_{user_id}"
        data = {
            "user_id": str(user_id),
            "email_type": email_type,
            "status": status.value,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        if identifier_id:
            data["identifier_id"] = str(identifier_id)

        logger.info(f"Emitting Socket.IO event '{event_name}' with data: {data}")
        await self.sio_server.emit(event_name, data, room=str(user_id))

    def _render_email_template(self, template_name: str, context: Dict[str, Any]) -> str:
        """Loads and renders an HTML email template using Jinja2."""
        try:
            template = jinja_env.get_template(template_name)
            return template.render(context)
        except Exception as e:
            logger.error(f"Error rendering email template {template_name}: {e}", exc_info=True)
            raise

    @retry(
        stop=stop_after_attempt(3), # Try up to 3 times
        wait=wait_exponential(multiplier=1, min=2, max=10), # Wait 2, 4, 8 seconds
        before_sleep=before_sleep_log(logger, logging.WARNING), # Log before retrying
        reraise=True # Re-raise the last exception if all retries fail
    )
    async def _send_email_with_tenacity(
        self,
        subject: str,
        body: str,
        recipients: List[str],
        user_id: UUID,
        email_type: str,
        identifier_id: UUID | None = None
    ) -> bool:
        """
        Sends an email with automatic retries using tenacity.
        Emits Socket.IO status updates for each attempt.
        """
        current_recipient_email = recipients[0] if recipients else "N/A" # For logging

        try:
            await self._emit_email_status(user_id, email_type, EmailStatusEnum.ATTEMPTING,
                                         f"Attempting to send email to {current_recipient_email} (with retries)...", identifier_id)

            email_sent = await _async_send_email_sendgrid(
                subject=subject,
                body=body,
                recipients=recipients
            )

            if email_sent:
                logger.info(f"Email type '{email_type}' successfully sent to {current_recipient_email}.")
                await self._emit_email_status(user_id, email_type, EmailStatusEnum.SENT,
                                             f"Email sent successfully to {current_recipient_email}.", identifier_id)
                return True
            else:
                error_msg = f"Email utility reported failure for '{email_type}' to {current_recipient_email}."
                logger.warning(error_msg)
                raise Exception(error_msg) # Raise an exception to trigger tenacity to retry

        except Exception as e:
            error_msg = f"Failed to send email type '{email_type}' to {current_recipient_email}: {e}"
            logger.error(error_msg, exc_info=True)
            await self._emit_email_status(user_id, email_type, EmailStatusEnum.FAILED,
                                         f"Failed to send email to {current_recipient_email}. Error: {e}", identifier_id)
            raise # Re-raise to let tenacity handle the retry or final failure
    # --- END NEW PRIVATE HELPER ---


    # --- MODIFIED: _async_send_email_via_utils (Now a dispatcher) ---
    async def _async_send_email_via_utils(
        self,
        subject: str,
        body: str,
        recipients: List[str],
        user_id: UUID,
        email_type: str,
        identifier_id: UUID | None = None,
        use_retries: bool = True # NEW PARAMETER - default to True for background tasks
    ) -> bool:
        """
        Internal wrapper to use the consolidated SendGrid-based async email utility.
        Can send with or without retries based on 'use_retries' flag.
        """
        if not recipients:
            logger.warning(f"Attempted to send email with no recipients for user {user_id}, type {email_type}.")
            await self._emit_email_status(user_id, email_type, EmailStatusEnum.FAILED, "No recipients specified.", identifier_id)
            return False

        if use_retries:
            try:
                # Call the retry-enabled helper
                return await self._send_email_with_tenacity(
                    subject, body, recipients, user_id, email_type, identifier_id
                )
            except Exception as e:
                # Final failure after all retries in _send_email_with_tenacity
                logger.error(f"Final failure after all retries for email type '{email_type}' for user {user_id}: {e}", exc_info=True)
                return False
        else:
            # Single attempt without retries (for real-time user-initiated emails)
            current_recipient_email = recipients[0]

            try:
                await self._emit_email_status(user_id, email_type, EmailStatusEnum.ATTEMPTING,
                                             f"Attempting to send email to {current_recipient_email} (single attempt)...", identifier_id)

                email_sent = await _async_send_email_sendgrid(
                    subject=subject,
                    body=body,
                    recipients=recipients
                )

                if email_sent:
                    logger.info(f"Email type '{email_type}' successfully sent to {current_recipient_email} (single attempt).")
                    await self._emit_email_status(user_id, email_type, EmailStatusEnum.SENT,
                                                 f"Email sent successfully to {current_recipient_email}.", identifier_id)
                    return True
                else:
                    error_msg = f"Email utility reported failure for '{email_type}' to {current_recipient_email} (single attempt)."
                    logger.warning(error_msg)
                    await self._emit_email_status(user_id, email_type, EmailStatusEnum.FAILED,
                                                 f"Failed to send email to {current_recipient_email}.", identifier_id)
                    return False

            except Exception as e:
                error_msg = f"Unexpected error sending email type '{email_type}' to {current_recipient_email} (single attempt): {e}"
                logger.error(error_msg, exc_info=True)
                await self._emit_email_status(user_id, email_type, EmailStatusEnum.FAILED,
                                             f"Failed to send email due to an internal error.", identifier_id)
                return False
    # --- END MODIFIED ---


    # --- MODIFIED: send_email_direct (Takes new 'use_retries' param, default False) ---
    async def send_email_direct(self, to_email: str, subject: str, html_content: str, user_id: UUID, email_type: str = "direct_notification", text_content: str = "", use_retries: bool = False) -> bool:
        """
        Sends a simple email directly using the internal consolidated SendGrid utility.
        'use_retries=False' by default for immediate feedback to user (e.g., forgot password).
        """
        logger.info(f"Attempting to send direct email to: {to_email} with subject '{subject}' (Type: {email_type}, Retries: {use_retries})")
        return await self._async_send_email_via_utils(
            subject=subject,
            body=html_content,
            recipients=[to_email],
            user_id=user_id,
            email_type=email_type,
            identifier_id=None,
            use_retries=use_retries # Pass the new parameter
        )
    # --- END MODIFIED ---

    async def send_ride_creation_email(
        self,
        ride_id: UUID,
        recipient_id: UUID,
        db: Session,
        ride_details: Dict[str, Any],
        email_type: str = "new_ride_request_to_supervisor",
        use_retries: bool = False
    ) -> bool:
        logger.info(f"Attempting to send {email_type} email for ride {ride_id} to recipient {recipient_id} (Retries: {use_retries})")
        recipient_email = await self._get_user_email(recipient_id, db)

        if not recipient_email:
            error_msg = f"Cannot send email: Recipient email not found for ID {recipient_id}."
            logger.error(error_msg)
            await self._emit_email_status(recipient_id, email_type, EmailStatusEnum.FAILED, error_msg, ride_id)
            return False

        # The subject and template are specific to the supervisor email
        subject = "📄 בקשת נסיעה חדשה מחכה לאישורך"
        template_name = "new_ride_request.html"

        # Corrected context dictionary to match template variables
        # The keys here MUST match the {{...}} placeholders in your HTML file
        context = {
            "SUPERVISOR_NAME": ride_details.get("supervisor_name", "מנהל"),
            "EMPLOYEE_NAME": ride_details.get("username", "העובד"),
            "DESTINATION": ride_details.get("destination", "לא צוין"),
            "DATE_TIME": ride_details.get("start_datetime", datetime.now()).strftime("%Y-%m-%d %H:%M"),
            "PLATE_NUMBER": ride_details.get("plate_number", "לא נבחר"),
            "DISTANCE": ride_details.get("estimated_distance_km", "לא חושב"),
            "STATUS": ride_details.get("status", "pending"),
            "LINK_TO_ORDER": f"http://localhost:4200/order-card/{ride_details.get('ride_id')}"
        }

        try:
            html_content = self._render_email_template(template_name, context)

            email_sent_successfully = await self._async_send_email_via_utils(
                subject=subject,
                body=html_content,
                recipients=[recipient_email],
                user_id=recipient_id,
                email_type=email_type,
                identifier_id=ride_id,
                use_retries=use_retries
            )
            return email_sent_successfully

        except Exception as e:
            error_msg = f"Unhandled exception during {email_type} email preparation for ride {ride_id} to {recipient_email}: {e}"
            logger.error(error_msg, exc_info=True)
            await self._emit_email_status(recipient_id, email_type, EmailStatusEnum.FAILED, "Email preparation failed.", ride_id)
            return False
        

    # --- ADD/MODIFY send_ride_cancellation_email (accept use_retries, default False) ---
    async def send_ride_cancellation_email(self, ride_id: UUID, recipient_id: UUID, db: Session, ride_details: Dict[str, Any], cancellation_reason: str = "Unknown reason", use_retries: bool = False) -> bool:
        logger.info(f"Attempting to send ride cancellation email for ride {ride_id} to recipient {recipient_id} (Retries: {use_retries})")
        recipient_email = await self._get_user_email(recipient_id, db)

        if not recipient_email:
            error_msg = f"Cannot send cancellation email: Recipient email not found for ID {recipient_id}."
            logger.error(error_msg)
            await self._emit_email_status(recipient_id, "ride_cancellation", EmailStatusEnum.FAILED, error_msg, ride_id)
            return False

        subject = "Your Ride Has Been Cancelled"
        template_name = "ride_cancellation_notification.html"

        context = {
            "username": ride_details.get("username", "Rider"),
            "ride_id": str(ride_details.get("id")),
            "start_location": ride_details.get("start_location", "N/A"),
            "destination": ride_details.get("destination", "N/A"),
            "cancellation_reason": cancellation_reason,
            "cancel_datetime": datetime.now().strftime("%Y-%m-%d %H:%M"),
        }

        try:
            html_content = self._render_email_template(template_name, context)
            email_sent_successfully = await self._async_send_email_via_utils(
                subject=subject,
                body=html_content,
                recipients=[recipient_email],
                user_id=recipient_id,
                email_type="ride_cancellation",
                identifier_id=ride_id,
                use_retries=use_retries # Pass the new parameter
            )
            return email_sent_successfully
        except Exception as e:
            error_msg = f"Failed to send cancellation email for ride {ride_id} to {recipient_email}: {e}"
            logger.error(error_msg, exc_info=True)
            await self._emit_email_status(recipient_id, "ride_cancellation", EmailStatusEnum.FAILED, "Email preparation failed.", ride_id)
            return False
        

# email_service = EmailService(sio_server=global_sio_instance)

# # this is the function the scheduler will call.
# def send_ride_completion_email(ride_id: str):
#     """
#     This is the function called by the scheduler.
#     It acts as a dispatcher to the async EmailService.
#     """
#     db = SessionLocal()
#     try:
#         ride = db.query(Ride).filter(Ride.id == ride_id).first()
#         if not ride:
#             print(f"❌ Ride with ID {ride_id} not found.")
#             return

#         user = db.query(User).filter(User.employee_id == ride.user_id).first()
#         if not user:
#             print(f"❌ User for ride ID {ride_id} not found.")
#             return

#         form_link = f"https://localhost:8000/ride-completion-form/{ride.id}"

#         # Populate the dictionary with ALL the data needed by the template.
#         ride_details = {
#             "username": user.first_name,
#             "id": ride.id,
#             "start_location": ride.start_location,
#             "destination": ride.destination,
#             "start_datetime": ride.start_datetime,
#             "end_datetime": ride.end_datetime,
#             "plate_number": ride.vehicle.plate_number if ride.vehicle else "N/A",
#             "ride_type": ride.ride_type,
#             "form_link": form_link  # The link for the template
#         }

#         print(f"🚀 Dispatching email for ride {ride_id} via EmailService...")
#         asyncio.run(
#             email_service.send_ride_completion_email(
#                 ride_id=UUID(ride.id),
#                 recipient_id=UUID(user.employee_id), 
#                 db=db,
#                 ride_details=ride_details,
#                 use_retries=True
#             )
#         )
#         print(f"✅ Email for ride {ride_id} successfully dispatched.")

#     except Exception as e:
#         print(f"🔥 An error occurred while dispatching email for ride {ride_id}: {e}")
#     finally:
#         db.close()