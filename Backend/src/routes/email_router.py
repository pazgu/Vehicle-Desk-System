from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID
from typing import Dict, Annotated, Any
from sqlalchemy.orm import Session
import socketio
import logging
import os
from datetime import datetime, timedelta

from ..services import form_email

logger = logging.getLogger(__name__)

from ..schemas.email_status_schema import RetryEmailRequest, EmailStatusEnum
from ..services.email_clean_service import EmailService 
from ..utils.socket_manager import sio as global_sio_instance
from ..utils.auth import get_current_user
from ..utils.database import get_db

from src.models.ride_model import Ride as RideModel
from src.models.user_model import User as UserModel
from src.models.city_model import City

from ..services.user_notification import get_supervisor_id, get_user_name 
from ..services.user_data import get_user_email 
from ..services.auth_service import create_reset_token


router = APIRouter(prefix="/emails", tags=["Emails"])

BOOKIT_FRONTEND_URL = os.getenv("BOOKIT_FRONTEND_URL", "http://localhost:4200")

async def get_email_service(
    sio_server: Annotated[socketio.AsyncServer, Depends(lambda: global_sio_instance)]
) -> EmailService:
    return EmailService(sio_server=sio_server)


@router.post("/retry", response_model=Dict[str, str], status_code=status.HTTP_202_ACCEPTED)
async def retry_email(
    request: RetryEmailRequest,
    current_user: Annotated[UUID, Depends(get_current_user)],
    email_service: Annotated[EmailService, Depends(get_email_service)],
    db: Session = Depends(get_db)
):
    current_user_id = current_user.employee_id
    identifier_id = request.identifier_id
    email_type = request.email_type 

    try:
        logger.info(f"Initiating retry for email type: '{email_type}', identifier ID: '{identifier_id}' by user {current_user_id}")

        email_sent_successfully = False
        email_identifier_id_for_status: UUID = identifier_id

        if email_type == "forgot_password":
            user_to_reset = db.query(UserModel).filter(UserModel.employee_id == identifier_id).first()
            if not user_to_reset or not user_to_reset.email:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User or user email not found for password reset.")

            recipient_id = user_to_reset.employee_id
            recipient_email = user_to_reset.email
            
            reset_token = create_reset_token(user_to_reset.employee_id)
            reset_link = f"{BOOKIT_FRONTEND_URL}/reset-password?token={reset_token}&user_id={user_to_reset.employee_id}"
            
            email_html_content = email_service._render_email_template(
                "password_reset_email.html",
                {"reset_link": reset_link, "username": user_to_reset.username}
            )

            email_sent_successfully = await email_service.send_email_direct(
                to_email=recipient_email,
                subject="BookIt - Password Reset Request",
                html_content=email_html_content,
                user_id=recipient_id,
                email_type="forgot_password_retry",
                use_retries=True
            )

        elif email_type == "ride_creation":
            ride_db_object = db.query(RideModel).filter(RideModel.id == identifier_id).first()
            if not ride_db_object:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Ride with ID {identifier_id} not found.")

            recipient_id = get_supervisor_id(ride_db_object.user_id, db)
            if not recipient_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recipient (supervisor) not found for this ride.")
            
            recipient_email = get_user_email(recipient_id, db)
            if not recipient_email:
                 raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recipient email address not found.")

            email_identifier_id_for_status = ride_db_object.id

            destination_city = db.query(City).filter(City.id == ride_db_object.stop).first()
            destination_name = destination_city.name if destination_city else str(ride_db_object.stop)
            employee_name = get_user_name(db, ride_db_object.user_id)

            ride_details_for_email: Dict[str, Any] = {
                "username": employee_name,
                "ride_id": str(ride_db_object.id),
                "start_location": ride_db_object.start_location,
                "destination": destination_name,
                "start_datetime": ride_db_object.start_datetime.strftime("%Y-%m-%d %H:%M"),
                "end_datetime": ride_db_object.end_datetime.strftime("%Y-%m-%d %H:%M"),
                "plate_number": ride_db_object.plate_number or "N/A",
                "estimated_distance_km": ride_db_object.estimated_distance_km,
                "ride_type": ride_db_object.ride_type,
                "status": ride_db_object.status.value
            }
            
            email_sent_successfully = await email_service.send_ride_creation_email(
                ride_id=ride_db_object.id,
                recipient_id=recipient_id,
                db=db,
                ride_details=ride_details_for_email,
                email_type="ride_creation_retry",
                use_retries=True
            )

        elif email_type == "ride_completion":
            ride_db_object = db.query(RideModel).filter(RideModel.id == identifier_id).first()
            if not ride_db_object:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Ride with ID {identifier_id} not found.")

            recipient_id = ride_db_object.user_id
            recipient_email = get_user_email(recipient_id, db)
            if not recipient_email:
                 raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recipient email address not found.")

            email_identifier_id_for_status = ride_db_object.id

            destination_city = db.query(City).filter(City.id == ride_db_object.stop).first()
            destination_name = destination_city.name if destination_city else str(ride_db_object.stop)
            employee_name = get_user_name(db, ride_db_object.user_id)

            ride_details_for_email = {
                "username": employee_name,
                "ride_id": str(ride_db_object.id),
                "start_location": ride_db_object.start_location,
                "destination": destination_name,
                "start_datetime": ride_db_object.start_datetime.strftime("%Y-%m-%d %H:%M"),
                "end_datetime": ride_db_object.end_datetime.strftime("%Y-%m-%d %H:%M"),
                "plate_number": ride_db_object.plate_number or "N/A",
                "ride_type": ride_db_object.ride_type,
            }
            
            email_sent_successfully = await form_email.send_ride_completion_email(
                ride_id=ride_db_object.id,
                recipient_id=recipient_id,
                db=db,
                ride_details=ride_details_for_email,
                use_retries=True
            )

        elif email_type == "ride_cancellation":
            ride_db_object = db.query(RideModel).filter(RideModel.id == identifier_id).first()
            if not ride_db_object:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Ride with ID {identifier_id} not found.")

            recipient_id = ride_db_object.user_id
            recipient_email = get_user_email(recipient_id, db)
            if not recipient_email:
                 raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recipient email address not found.")

            email_identifier_id_for_status = ride_db_object.id

            destination_city = db.query(City).filter(City.id == ride_db_object.stop).first()
            destination_name = destination_city.name if destination_city else str(ride_db_object.stop)
            employee_name = get_user_name(db, ride_db_object.user_id)
            
            ride_details_for_email = {
                "username": employee_name,
                "ride_id": str(ride_db_object.id),
                "start_location": ride_db_object.start_location,
                "destination": destination_name,
                "cancellation_reason": "N/A", # Placeholder, retrieve actual reason if available
            }
            
            email_sent_successfully = await email_service.send_ride_cancellation_email(
                ride_id=ride_db_object.id,
                recipient_id=recipient_id,
                db=db,
                ride_details=ride_details_for_email,
                cancellation_reason="N/A", # Placeholder, provide actual reason
                use_retries=True
            )

        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported email type for retry: '{email_type}'")

        if email_sent_successfully:
            await email_service._emit_email_status(
                user_id=current_user_id,
                email_type=f"{email_type}_retry_result",
                status=EmailStatusEnum.SENT,
                message=f"Email retry for {email_type} (ID: {identifier_id}) succeeded.",
                identifier_id=email_identifier_id_for_status
            )
            logger.info(f"Email retry successfully handled for type: {email_type}, ID: {identifier_id}")
            return {"message": "Email retry request accepted. Status will be updated via Socket.IO."}
        else:
            await email_service._emit_email_status(
                user_id=current_user_id,
                email_type=f"{email_type}_retry_result",
                status=EmailStatusEnum.FAILED,
                message=f"Email retry for {email_type} (ID: {identifier_id}) failed after attempts.",
                identifier_id=email_identifier_id_for_status
            )
            logger.error(f"Email retry attempt failed for type: {email_type}, ID: {identifier_id}.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Email retry for {email_type} failed after attempts. Please try again later or contact support."
            )

    except HTTPException as e:
        logger.error(f"HTTPException during email retry for '{email_type}': {e.detail}", exc_info=True)
        await email_service._emit_email_status(
            user_id=current_user_id,
            email_type=f"{email_type}_retry_result",
            status=EmailStatusEnum.FAILED,
            message=f"Email retry for {email_type} (ID: {identifier_id}) failed: {e.detail}",
            identifier_id=identifier_id
        )
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during email retry for '{email_type}', ID '{identifier_id}': {e}", exc_info=True)
        await email_service._emit_email_status(
            user_id=current_user_id,
            email_type=f"{email_type}_retry_result",
            status=EmailStatusEnum.FAILED,
            message=f"Email retry for {email_type} (ID: {identifier_id}) failed due to an internal error.",
            identifier_id=identifier_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate email retry due to an internal server error: {e}"
        )