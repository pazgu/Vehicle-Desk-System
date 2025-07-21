from sqlalchemy.orm import Session
from sqlalchemy.types import String  # To cast to string
from typing import Optional, List , Dict , Union
from ..models.vehicle_model import Vehicle, VehicleStatus
from sqlalchemy import func, cast 
from sqlalchemy import and_ , or_ , not_ , select
from ..models.ride_model import Ride, RideStatus
from ..models.user_model import User
from datetime import datetime, timezone, date, timedelta
from ..schemas.vehicle_schema import VehicleOut, InUseVehicleOut
from uuid import UUID
from sqlalchemy import text
from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError
from ..models.vehicle_inspection_model import VehicleInspection 
from ..schemas.check_vehicle_schema import VehicleInspectionSchema
from ..utils.audit_utils import log_action 
from ..schemas.user_rides_schema import RideSchema 
from ..services.email_service import get_user_email, load_email_template, async_send_email, send_email
from datetime import datetime

from src.utils.database import SessionLocal
from ..services.email_service import get_user_email, load_email_template, async_send_email, send_email
from datetime import datetime

from fastapi.security import OAuth2PasswordBearer
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


# def vehicle_inspection_logic(data: VehicleInspectionSchema, db: Session):
#     inspection = VehicleInspection(
#         inspected_by=data.inspected_by,
#         inspection_date=datetime.now(timezone.utc),
#         clean=data.clean,
#         fuel_checked=data.fuel_checked,
#         no_items_left=data.no_items_left,
#         critical_issue_bool=data.critical_issue_bool,
#         issues_found=data.issues_found,
#     )

#     db.add(inspection)
#     db.commit()
#     db.refresh(inspection)

#     return {
#         "message": "Vehicle inspection recorded successfully",
#         "inspection_id": str(inspection.inspection_id)
#     }


def get_vehicles_with_optional_status(
    db: Session,
    status: Optional[VehicleStatus] = None,
    vehicle_type: Optional[str] = None  
) -> List[Union[VehicleOut, InUseVehicleOut]]:
    query = (
    db.query(
        Vehicle.id,
        Vehicle.plate_number,
        Vehicle.type,
        Vehicle.fuel_type,
        Vehicle.status,
        Vehicle.freeze_reason,
        Vehicle.last_used_at,
        Vehicle.current_location,
        Vehicle.mileage,
        Vehicle.vehicle_model,
        Vehicle.image_url,
        Vehicle.department_id, 
        Vehicle.lease_expiry,
        User.employee_id.label("user_id"),
        User.first_name,
        User.last_name,
        Ride.start_datetime,
        Ride.end_datetime,
    )
    .outerjoin(
        Ride,
        and_(
            Ride.vehicle_id == Vehicle.id,
            Ride.status == "approved",
            Ride.start_datetime <= datetime.now(),    
            Ride.end_datetime >= datetime.now()      
        ) 
    )    
    .outerjoin(User, User.employee_id == Ride.user_id)
    .filter(Vehicle.is_archived == False)
)
    if status:
        query = query.filter(Vehicle.status == status)
    if vehicle_type:
        query = query.filter(func.lower(Vehicle.type) == vehicle_type.lower())
    vehicles = query.all()
    return vehicles


def update_vehicle_status(vehicle_id: UUID, new_status: VehicleStatus, freeze_reason: str, db: Session, changed_by: UUID, notes: Optional[str] = None):
    FREEZE_REASON_TRANSLATIONS = {
    "accident": "תאונה",
    "maintenance": "תחזוקה",
    "personal": "אישי "
}

    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(changed_by)})
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    try:
        old_status = vehicle.status  # Save before updating
        if new_status == VehicleStatus.frozen:
            if not freeze_reason:
                raise HTTPException(status_code=400, detail="freeze_reason is required when setting status to 'frozen'")
            vehicle.freeze_reason = freeze_reason
        elif vehicle.status == VehicleStatus.frozen and new_status != VehicleStatus.frozen:
            vehicle.freeze_reason = None

        vehicle.status = new_status
        db.commit()
        db.refresh(vehicle)

        # 🔍 Try to find a supervisor from the same department (if any)
        # --- Email Recipient Determination Logic ---
        recipient_emails_set: set[str] = set() # Use a set to handle duplicates automatically
        log_messages: List[str] = []

        # 1. Get the user who performed the change (actor - e.g., Yorgo or Zalman)
        # Find the actor to use their name in the email context, but NOT necessarily as a recipient
        actor_user = db.query(User).filter(User.employee_id == changed_by).first()
        if not actor_user:
            log_messages.append("Actor user not found for context.")

        # NEW LOGIC FOR RECIPIENTS: STRICTLY ONLY SUPERVISORS
        supervisor_found_for_vehicle_department = False

        if vehicle.department_id:
            # Try to find a supervisor in the vehicle's specific department
            department_supervisor = db.query(User).filter(
                User.department_id == vehicle.department_id,
                User.role == "supervisor",
                User.email.isnot(None),
                User.email != ''
            ).first()

            if department_supervisor and department_supervisor.email:
                recipient_emails_set.add(department_supervisor.email)
                log_messages.append(f"Added department-specific supervisor's email: {department_supervisor.email}")
                supervisor_found_for_vehicle_department = True
            else:
                log_messages.append(f"No specific supervisor found for vehicle's department {vehicle.department_id}.")
        else:
            log_messages.append(f"Vehicle {vehicle.plate_number} has no department ID.")


        # If no department-specific supervisor was found OR vehicle has no department,
        # THEN notify ALL general supervisors.
        if not supervisor_found_for_vehicle_department:
            log_messages.append("Falling back to all general supervisors.")
            general_supervisors = db.query(User).filter(
                User.role == "supervisor",
                User.email.isnot(None),
                User.email != ''
            ).all()
            for sup_user in general_supervisors:
                recipient_emails_set.add(sup_user.email)
                log_messages.append(f"Added general supervisor's email: {sup_user.email}")

        # Convert the set to a list for iteration
        recipient_emails = list(recipient_emails_set)


        print("\n".join(log_messages))
        print(f"Final determined email recipients: {', '.join(recipient_emails) if recipient_emails else 'None'}")

        # --- Prepare Email Content ---
        context = {
            "PLATE_NUMBER": vehicle.plate_number,
            "VEHICLE_MODEL": vehicle.vehicle_model if vehicle.vehicle_model else "N/A",
            "DATE_TIME": datetime.now().strftime("%d/%m/%Y %H:%M"),
            "FIRST_NAME": actor_user.first_name if actor_user and actor_user.first_name else "המערכת",
            "FREEZE_REASON": FREEZE_REASON_TRANSLATIONS.get(
                str(freeze_reason).split(".")[-1],  # fallback to raw key if not found
                str(freeze_reason).split(".")[-1]),
            "FREEZE_DETAILS": notes or "אין פרטים נוספים"
        }

        # --- Send Emails ---
        if recipient_emails:
            try:
                subject = ""
                html_content = ""

                if new_status == VehicleStatus.frozen:
                    subject = "📌 BookIt System Update: Vehicle Frozen"
                    html_content = load_email_template("vehicle_frozen.html", context)
                elif old_status == VehicleStatus.frozen and new_status != VehicleStatus.frozen:
                    subject = "✅ BookIt System Update: Vehicle Unfrozen"
                    html_content = load_email_template("vehicle_unfrozen.html", context)
                else:
                    print("No email action defined for this specific status change. Skipping email sending.")
                    return {"vehicle_id": vehicle.id, "new_status": vehicle.status, "freeze_reason": vehicle.freeze_reason}

                for email_address in recipient_emails:
                    send_email(email_address, subject, html_content)
                    print(f"✅ Email sent successfully to {email_address}.")

            except Exception as e:
                print(f"❌ Error during email sending process: {e}")
        else:
            print("No eligible recipients found, skipping email notification.")

    except SQLAlchemyError as e:
        db.rollback()
        print(f"❌ Database error in update_vehicle_status: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        db.rollback()
        print(f"❌ An unexpected error occurred in update_vehicle_status: {e}")
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")

    # log_action(
    #     db=db,
    #     action="update_vehicle_status",
    #     entity_type="Vehicle",
    #     entity_id=str(vehicle.id),
    #     change_data={
    #         "new_status": str(vehicle.status),
    #         "freeze_reason": vehicle.freeze_reason
    #     },
    #     changed_by=changed_by,
    #     checkbox_value=True,  # or the actual value
    #     inspected_at=datetime.utcnow(),  # or the actual inspection time
    #     inspector_id=changed_by,  # or the actual inspector's ID
    #     notes=notes  # can be None
    # )
    
    db.execute(text("SET session.audit.user_id = DEFAULT"))
    return {"vehicle_id": vehicle.id, "new_status": vehicle.status, "freeze_reason": vehicle.freeze_reason}

def get_available_vehicles_for_ride_by_id(db: Session, ride_id: UUID) -> List[VehicleOut]:
    ride = db.query(
        Ride.id,
        Ride.start_datetime,
        Ride.end_datetime,
        Ride.status
    ).filter(Ride.id == ride_id).first()

    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    if ride.status != "approved":
        raise HTTPException(status_code=400, detail="Ride is not approved")

    start_datetime = ride.start_datetime
    end_datetime = ride.end_datetime

    conflicting_vehicles_subquery = (
        db.query(Ride.vehicle_id)
        .filter(
            Ride.status.in_(["approved", "in_progress"]),
            or_(
                and_(Ride.start_datetime <= start_datetime, Ride.end_datetime > start_datetime),
                and_(Ride.start_datetime < end_datetime, Ride.end_datetime >= end_datetime),
                and_(Ride.start_datetime >= start_datetime, Ride.end_datetime <= end_datetime),
                and_(Ride.start_datetime <= start_datetime, Ride.end_datetime >= end_datetime),
            )
        )
        .subquery()
    )

    vehicles = (
        db.query(Vehicle)
        .filter(
            Vehicle.status == "available",
            ~Vehicle.id.in_(select(conflicting_vehicles_subquery.c.vehicle_id))
        )
        .all()
    )
    return [VehicleOut.from_orm(vehicle) for vehicle in vehicles]

def get_vehicle_by_id(vehicle_id: str, db: Session):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()

    if not vehicle:
        return None

    lease_expired = vehicle.lease_expiry and vehicle.lease_expiry.date() < date.today()
    can_delete = lease_expired and vehicle.status != VehicleStatus.in_use

    return {
        "id": str(vehicle.id),
        "plate_number": vehicle.plate_number,
        "type": vehicle.type,
        "fuel_type": vehicle.fuel_type,
        "status": vehicle.status,
        "freeze_reason": vehicle.freeze_reason,
        "last_used_at": vehicle.last_used_at,
        "current_location": vehicle.current_location,
        "mileage": vehicle.mileage,
        "vehicle_model": vehicle.vehicle_model,
        "image_url": vehicle.image_url,
        "lease_expiry": vehicle.lease_expiry,
        "department_id": vehicle.department_id,
        "canDelete": can_delete,
        "is_archived": vehicle.is_archived, 
        "archived_at": vehicle.archived_at   
    }

def freeze_vehicle_service(db: Session, vehicle_id: UUID, reason: str, changed_by: UUID):
    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(changed_by)})

    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    vehicle.status = VehicleStatus.frozen
    vehicle.freeze_reason = reason

    db.commit()
    db.refresh(vehicle)
    db.execute(text("SET session.audit.user_id = DEFAULT"))

    return {"message": f"Vehicle {vehicle_id} has been frozen successfully."}

    api_router.include_router(vehicle_route, prefix="/vehicles", tags=["Vehicles"])

def get_available_vehicles_by_type_and_time(
    db: Session,
    vehicle_type: str,
    start_datetime: datetime,
    end_datetime: datetime,
) -> List[Vehicle]:
    # שלב 1 - בחר רכבים לפי סוג וסטטוס זמין
    query = db.query(Vehicle).filter(
        Vehicle.type == vehicle_type,
        Vehicle.status == VehicleStatus.available,
    )
    
    # שלב 2 - שלוף את כל הרכבים שיש להם נסיעה שמתנגשת עם טווח התאריכים המבוקש
    conflicting_rides_subquery = db.query(Ride.vehicle_id).filter(
        or_(
            and_(
                Ride.start_datetime <= end_datetime,
                Ride.end_datetime >= start_datetime,
            )
        ),
        Ride.status != "cancelled",  # ניתן להוסיף סינון לביטולים
    ).subquery()
    
    # שלב 3 - סנן את הרכבים עם נסיעות מתנגשות
    query = query.filter(~Vehicle.id.in_(conflicting_rides_subquery))
    
    vehicles = query.all()
    return vehicles


def delete_vehicle_by_id(vehicle_id: UUID, db: Session, user_id: UUID):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    if vehicle.status == VehicleStatus.in_use:
        raise HTTPException(status_code=400, detail="Cannot delete a vehicle that is currently in use")

    if not vehicle.lease_expiry or vehicle.lease_expiry.date() >= date.today():
        raise HTTPException(status_code=400, detail="Cannot delete: lease not expired.")
    if vehicle.status == VehicleStatus.frozen:
        raise HTTPException(status_code=400, detail="Cannot delete: vehicle is frozen")
    if vehicle.is_archived:
        raise HTTPException(status_code=400, detail="Cannot delete: the vehicle is archived.")


    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user_id)})
    db.delete(vehicle)
    db.commit()
    db.execute(text("SET session.audit.user_id = DEFAULT"))

    return {"message": f"Vehicle {vehicle.plate_number} deleted successfully."}



async def get_inactive_vehicles():
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        one_week_ago = now - timedelta(days=7)

        # Get all vehicles
        all_vehicles = db.query(Vehicle).all()

        # Get latest ride per vehicle (if any)
        recent_rides_subq = db.query(
            Ride.vehicle_id,
            func.max(Ride.end_datetime).label("last_ride")
        ).filter(
            Ride.status == "completed"
        ).group_by(Ride.vehicle_id).subquery()

        # Join vehicles to recent ride
        inactive_vehicles = db.query(Vehicle, recent_rides_subq.c.last_ride).outerjoin(
            recent_rides_subq, Vehicle.id == recent_rides_subq.c.vehicle_id
        ).filter(
            or_(
                recent_rides_subq.c.last_ride == None,
                recent_rides_subq.c.last_ride < one_week_ago
            )
        ).all()

        if not inactive_vehicles:
            return
        else :
            return inactive_vehicles
        
    finally:
        db.close()

def archive_vehicle_by_id(vehicle_id: UUID, db: Session, user_id: UUID) -> Vehicle:
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    if vehicle.status != VehicleStatus.frozen:
        raise HTTPException(status_code=400, detail="Can only archive vehicles that are frozen.")

    if not vehicle.lease_expiry or vehicle.lease_expiry.date() >= date.today():
        raise HTTPException(status_code=400, detail="Cannot archive: lease not expired.")

    if vehicle.is_archived:
        raise HTTPException(status_code=400, detail="Vehicle is already archived.")

    # Check for related data (e.g., rides)
    has_related_data = db.execute(
        text("SELECT EXISTS (SELECT 1 FROM rides WHERE vehicle_id = :vehicle_id)"),
        {"vehicle_id": str(vehicle_id)}
    ).scalar()

    if not has_related_data:
        raise HTTPException(status_code=400, detail="Cannot archive: vehicle has no related data (rides, logs, etc.).")

    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user_id)})

    vehicle.is_archived = True
    vehicle.archived_at = datetime.utcnow()
    db.commit()

    # Manually insert audit log for reason visibility
    db.execute(
        text("""
            INSERT INTO audit_logs (
                action, entity_type, entity_id, change_data,
                changed_by, checkbox_value, inspected_at, notes
            ) VALUES (
                :action, :entity_type, :entity_id, :change_data,
                :changed_by, FALSE, now(), :notes
            )
        """),
        {
            "action": "ARCHIVE",
            "entity_type": "Vehicle",
            "entity_id": str(vehicle.id),
            "change_data": '{"archived": true}',
            "changed_by": str(user_id),
            "notes": "Vehicle archived manually by admin"
        }
    )

    db.execute(text("SET session.audit.user_id = DEFAULT"))
    return vehicle

