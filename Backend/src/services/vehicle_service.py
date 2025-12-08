from fastapi import HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import Date, func, cast, and_, or_, not_, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy.types import String
from datetime import datetime, timezone, date, timedelta
from typing import Optional, List, Dict, Union
from uuid import UUID

from ..helpers.user_helpers import cancel_future_rides_for_vehicle

from ..models.department_model import Department
from ..utils.socket_manager import sio

from ..models.audit_log_model import AuditLog

from ..models.no_show_events import NoShowEvent
from ..models.ride_approval_model import RideApproval
from ..models.ride_log_model import RideLog

from ..models.monthly_vehicle_usage_model import MonthlyVehicleUsage
from ..models.notification_model import Notification, NotificationType

# Utils
from ..utils.audit_utils import log_action
from src.utils.database import SessionLocal

# Services

# Schemas
from ..schemas.check_vehicle_schema import VehicleInspectionSchema
from ..schemas.user_rides_schema import RideSchema
from ..schemas.vehicle_schema import VehicleOut, InUseVehicleOut , VehicleUpdateRequest

# Models
from ..models.ride_model import Ride, RideStatus
from ..models.user_model import User
from ..models.vehicle_inspection_model import VehicleInspection
from ..models.vehicle_model import Vehicle, VehicleStatus

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def get_vehicle_km_driven_on_date(db: Session, vehicle_id: int, day: date) -> float:
    rides = db.query(Ride).filter(
        Ride.vehicle_id == vehicle_id,
        cast(Ride.start_datetime, Date) == day
    ).all()

    return sum(r.actual_distance_km or 0 for r in rides)


def get_vehicles_with_optional_status(
    db: Session,
    status: Optional[VehicleStatus] = None,
    type: Optional[str] = None
) -> List[Vehicle]:
    query = db.query(Vehicle).filter(Vehicle.is_archived == False)
    
    if status:
        query = query.filter(Vehicle.status == status)
    if type:
        query = query.filter(func.lower(Vehicle.type) == type.lower())
        

    final_query=query.all()


    return final_query



from sqlalchemy import and_, or_
from datetime import timedelta

def get_available_vehicles_new_ride(
    db: Session,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    type: Optional[str] = None,
    department_id: Optional[str] = None
) -> List[Vehicle]:
    now = datetime.utcnow()  

    query = (
        db.query(Vehicle)
        .filter(
            Vehicle.is_archived == False,
            Vehicle.status == VehicleStatus.available,
            Vehicle.lease_expiry > now       
        )
    )

    if type:
        query = query.filter(func.lower(Vehicle.type) == type.lower())
    if department_id:
        query = query.filter(
            or_(
                Vehicle.department_id == department_id,
                Vehicle.department_id == None
            )
        )

    if start_time and end_time:
        end_time_with_buffer = end_time + timedelta(hours=2)

        overlapping_rides = db.query(Ride.vehicle_id).filter(
            or_(
                and_(Ride.start_datetime <= start_time, Ride.end_datetime > start_time),
                and_(Ride.start_datetime < end_time_with_buffer, Ride.end_datetime >= end_time_with_buffer),
                and_(Ride.start_datetime >= start_time, Ride.end_datetime <= end_time_with_buffer)
            )
        ).subquery()

        query = query.filter(~Vehicle.id.in_(overlapping_rides))

    return query.all()

def get_vehicles_for_ride_edit(
    db: Session,
    distance_km: float,
    ride_date: Optional[date],
    vehicle_type: Optional[str],
    start_time: Optional[datetime],
    end_time: Optional[datetime],
    exclude_ride_id: Optional[str],
    user_department_id: Optional[UUID]
) -> List[Vehicle]:
    original_vehicle = None
    original_vehicle_id = None
    if exclude_ride_id:
        try:
            ride_uuid = UUID(exclude_ride_id) if isinstance(exclude_ride_id, str) else exclude_ride_id
            original_ride = db.query(Ride).filter(Ride.id == ride_uuid).first()
            if original_ride and original_ride.vehicle_id:
                original_vehicle_id = original_ride.vehicle_id
                original_vehicle = db.query(Vehicle).filter(
                    Vehicle.id == original_vehicle_id
                ).first()
        except Exception as e:
            print(f"Error fetching original vehicle: {e}")
    now = datetime.utcnow()
    query = (
        db.query(Vehicle)
        .filter(
            Vehicle.is_archived == False,
            Vehicle.status == VehicleStatus.available,
            Vehicle.lease_expiry > now
        )
    )
    if vehicle_type:
        query = query.filter(func.lower(Vehicle.type) == vehicle_type.lower())
    if user_department_id:
        query = query.filter(
            or_(
                Vehicle.department_id == user_department_id,
                Vehicle.department_id == None
            )
        )
    if start_time and end_time:
        end_time_with_buffer = end_time + timedelta(hours=2)
        overlapping_rides_query = db.query(Ride.vehicle_id).filter(
            or_(
                and_(Ride.start_datetime <= start_time, Ride.end_datetime > start_time),
                and_(Ride.start_datetime < end_time_with_buffer, Ride.end_datetime >= end_time_with_buffer),
                and_(Ride.start_datetime >= start_time, Ride.end_datetime <= end_time_with_buffer)
            )
        )
        if exclude_ride_id:
            try:
                ride_uuid = UUID(exclude_ride_id) if isinstance(exclude_ride_id, str) else exclude_ride_id
                overlapping_rides_query = overlapping_rides_query.filter(
                    Ride.id != ride_uuid
                )
            except Exception as e:
                print(f"Error excluding ride from conflicts: {e}")
        
        overlapping_rides = overlapping_rides_query.subquery()
        query = query.filter(~Vehicle.id.in_(overlapping_rides))
    
    vehicles = query.all()
    if original_vehicle and original_vehicle_id:
        is_available = (
            original_vehicle.status == VehicleStatus.available and
            not original_vehicle.freeze_reason and
            not original_vehicle.is_archived and
            original_vehicle.lease_expiry > now
        )
        is_correct_type = (
            not vehicle_type or 
            (original_vehicle.type and original_vehicle.type.lower() == vehicle_type.lower())
        )
        is_correct_department = (
            not user_department_id or
            original_vehicle.department_id == user_department_id or
            original_vehicle.department_id is None
        )
        is_not_conflicting = True
        if start_time and end_time:
            try:
                end_time_with_buffer = end_time + timedelta(hours=2)
                conflicting_ride_query = db.query(Ride).filter(
                    Ride.vehicle_id == original_vehicle_id,
                    or_(
                        and_(Ride.start_datetime <= start_time, Ride.end_datetime > start_time),
                        and_(Ride.start_datetime < end_time_with_buffer, Ride.end_datetime >= end_time_with_buffer),
                        and_(Ride.start_datetime >= start_time, Ride.end_datetime <= end_time_with_buffer)
                    )
                )
                if exclude_ride_id:
                    try:
                        ride_uuid = UUID(exclude_ride_id) if isinstance(exclude_ride_id, str) else exclude_ride_id
                        conflicting_ride_query = conflicting_ride_query.filter(
                            Ride.id != ride_uuid
                        )
                    except:
                        pass
                conflicting_ride = conflicting_ride_query.first()
                is_not_conflicting = conflicting_ride is None
            except Exception as e:
                print(f"Error checking conflicts for original vehicle: {e}")
                is_not_conflicting = False
        all_checks_passed = (
            is_available and 
            is_correct_type and 
            is_correct_department and 
            is_not_conflicting
        )
        if all_checks_passed and not any(v.id == original_vehicle_id for v in vehicles):
            vehicles.insert(0, original_vehicle)
    if not vehicles:
        return []
    electric, hybrid, fuel, electric_low = [], [], [], []
    for v in vehicles:
        try:
            if v.fuel_type == "electric":
                km_today = get_vehicle_km_driven_on_date(
                    db, v.id, ride_date or date.today()
                )
                if distance_km + float(km_today) <= 200:
                    electric.append(v)
                else:
                    electric_low.append(v)
            elif v.fuel_type == "hybrid":
                hybrid.append(v)
            elif v.fuel_type == "gasoline":
                fuel.append(v)
        except Exception as e:
            print(f"Error processing vehicle {v.id}: {e}")
            continue
    if distance_km <= 200 and electric:
        return electric
    elif hybrid:
        return hybrid
    elif fuel:
        return fuel
    else:
        return electric_low

def get_vip_vehicles_for_ride(
    db: Session,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    type: Optional[str] = None,
    user_id: Optional[UUID] = None
) -> List[Vehicle]:
    now = datetime.utcnow()

    vip_name='VIP'
    vip_department  = db.query(Department).filter(
        func.lower(Department.name) == vip_name.lower()
    ).first()

    if not vip_department:
        return []
    user_department_id = None
    if user_id:
        user = db.query(User).filter(User.employee_id == user_id).first()
        if user:
            user_department_id = user.department_id
    query = (
        db.query(Vehicle)
        .filter(
            Vehicle.is_archived == False,
            Vehicle.status == VehicleStatus.available,
            Vehicle.lease_expiry > now,
            Vehicle.department_id == vip_department.id   
        )
    )

    if type:
        query = query.filter(func.lower(Vehicle.type) == type.lower())

    if start_time and end_time:
        end_time_with_buffer = end_time + timedelta(hours=2)

        overlapping_rides = db.query(Ride.vehicle_id).filter(
            or_(
                and_(Ride.start_datetime <= start_time, Ride.end_datetime > start_time),
                and_(Ride.start_datetime < end_time_with_buffer, Ride.end_datetime >= end_time_with_buffer),
                and_(Ride.start_datetime >= start_time, Ride.end_datetime <= end_time_with_buffer)
            )
        ).subquery()

        query = query.filter(~Vehicle.id.in_(overlapping_rides))

    return query.all()




def get_most_used_vehicles_all_time(db: Session) -> Dict[str, int]:
    """
    Get vehicle usage statistics for all time
    Returns a dictionary mapping vehicle_id to total ride count
    """
    stats = db.query(
        Ride.vehicle_id,
        func.count(Ride.id).label('total_rides')
    ).filter(
        Ride.status.in_(['completed', 'in_progress'])
    ).group_by(Ride.vehicle_id).all()
    
    return {str(stat.vehicle_id): stat.total_rides for stat in stats}


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
        old_status = vehicle.status
        if new_status == VehicleStatus.frozen:
            if not freeze_reason:
                raise HTTPException(status_code=400, detail="freeze_reason is required when setting status to 'frozen'")
            vehicle.freeze_reason = freeze_reason
        elif vehicle.status == VehicleStatus.frozen and new_status != VehicleStatus.frozen:
            vehicle.freeze_reason = None

        vehicle.status = new_status
        db.commit()
        db.refresh(vehicle)

        # Try to find a supervisor from the same department (if any)
        # --- Email Recipient Determination Logic ---
        # recipient_emails_set: set[str] = set() # Use a set to handle duplicates automatically
        # log_messages: List[str] = []

        # # 1. Get the user who performed the change (actor - e.g., Yorgo or Zalman)
        # # Find the actor to use their name in the email context, but NOT necessarily as a recipient
        # actor_user = db.query(User).filter(User.employee_id == changed_by).first()
        # if not actor_user:
        #     log_messages.append("Actor user not found for context.")

        # # NEW LOGIC FOR RECIPIENTS: STRICTLY ONLY SUPERVISORS
        # supervisor_found_for_vehicle_department = False

        # if vehicle.department_id:
        #     # Try to find a supervisor in the vehicle's specific department
        #     department_supervisor = db.query(User).filter(
        #         User.department_id == vehicle.department_id,
        #         User.role == "supervisor",
        #         User.email.isnot(None),
        #         User.email != ''
        #     ).first()

        #     if department_supervisor and department_supervisor.email:
        #         recipient_emails_set.add(department_supervisor.email)
        #         log_messages.append(f"Added department-specific supervisor's email: {department_supervisor.email}")
        #         supervisor_found_for_vehicle_department = True
        #     else:
        #         log_messages.append(f"No specific supervisor found for vehicle's department {vehicle.department_id}.")
        # else:
        #     log_messages.append(f"Vehicle {vehicle.plate_number} has no department ID.")


        # # If no department-specific supervisor was found OR vehicle has no department,
        # # THEN notify ALL general supervisors.
        # if not supervisor_found_for_vehicle_department:
        #     log_messages.append("Falling back to all general supervisors.")
        #     general_supervisors = db.query(User).filter(
        #         User.role == "supervisor",
        #         User.email.isnot(None),
        #         User.email != ''
        #     ).all()
        #     for sup_user in general_supervisors:
        #         recipient_emails_set.add(sup_user.email)
        #         log_messages.append(f"Added general supervisor's email: {sup_user.email}")

        # # Convert the set to a list for iteration
        # recipient_emails = list(recipient_emails_set)



        # context = {
        #     "PLATE_NUMBER": vehicle.plate_number,
        #     "VEHICLE_MODEL": vehicle.vehicle_model if vehicle.vehicle_model else "N/A",
        #     "DATE_TIME": datetime.now().strftime("%d/%m/%Y %H:%M"),
        #     "FIRST_NAME": actor_user.first_name if actor_user and actor_user.first_name else "המערכת",
        #     "FREEZE_REASON": FREEZE_REASON_TRANSLATIONS.get(
        #         str(freeze_reason).split(".")[-1],  # fallback to raw key if not found
        #         str(freeze_reason).split(".")[-1]),
        #     "FREEZE_DETAILS": notes or "אין פרטים נוספים"
        # }

        # # --- Send Emails ---
        # if recipient_emails:
        #     try:
        #         subject = ""
        #         html_content = ""

        #         if new_status == VehicleStatus.frozen:
        #             subject = "📌 BookIt System Update: Vehicle Frozen"
        #             html_content = load_email_template("vehicle_frozen.html", context)
        #         elif old_status == VehicleStatus.frozen and new_status != VehicleStatus.frozen:
        #             subject = "✅ BookIt System Update: Vehicle Unfrozen"
        #             html_content = load_email_template("vehicle_unfrozen.html", context)
        #         else:
        #             return {"vehicle_id": vehicle.id, "new_status": vehicle.status, "freeze_reason": vehicle.freeze_reason}

        #         for email_address in recipient_emails:
        #             send_email(email_address, subject, html_content)

            # except Exception as e:
            #     print(f"Error during email sending process: {e}")

    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")
    
    db.execute(text("SET session.audit.user_id = DEFAULT"))
    return {"vehicle_id": vehicle.id, "new_status": vehicle.status, "freeze_reason": vehicle.freeze_reason}

def get_available_vehicles_for_ride_by_id(db: Session, ride_id: UUID, user_department_id: Optional[UUID] = None) -> List[VehicleOut]:
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    if ride.status != RideStatus.approved:
        raise HTTPException(status_code=400, detail="Ride is not approved")

    start_datetime = ride.start_datetime
    end_datetime = ride.end_datetime
    ride_distance = ride.estimated_distance_km

    conflicting_vehicles_subquery = (
        db.query(Ride.vehicle_id)
        .filter(
            Ride.status.in_(["approved", "in_progress"]),
            Ride.id != ride_id,
            or_(
                and_(Ride.start_datetime <= start_datetime, Ride.end_datetime > start_datetime),
                and_(Ride.start_datetime < end_datetime, Ride.end_datetime >= end_datetime),
                and_(Ride.start_datetime >= start_datetime, Ride.end_datetime <= end_datetime),
                and_(Ride.start_datetime <= start_datetime, Ride.end_datetime >= end_datetime),
            )
        )
        .subquery()
    )

    candidate_vehicles = (
        db.query(Vehicle).filter(
            Vehicle.status == "available",
            Vehicle.is_archived == False,
            ~Vehicle.id.in_(select(conflicting_vehicles_subquery.c.vehicle_id))
        )
    )
    if user_department_id:
        candidate_vehicles = candidate_vehicles.filter(
            or_(
                Vehicle.department_id == None,
                Vehicle.department_id == user_department_id
            )
        )
    candidate_vehicles = candidate_vehicles.all()
    today_start = datetime.combine(start_datetime.date(), datetime.min.time())
    today_end = today_start + timedelta(days=1)

    available_vehicles = []
    for vehicle in candidate_vehicles:
        if vehicle.max_daily_distance_km is None:
            available_vehicles.append(vehicle)
            continue

        used_distance = db.query(func.coalesce(func.sum(Ride.actual_distance_km), 0)).filter(
            Ride.vehicle_id == vehicle.id,
            Ride.id != ride_id,
            Ride.start_datetime >= today_start,
            Ride.start_datetime < today_end,
            Ride.status.in_(["approved", "in_progress", "completed"]) 
        ).scalar()

        if (vehicle.max_daily_distance_km - used_distance) >= ride_distance:
            available_vehicles.append(vehicle)

    return [VehicleOut.from_orm(vehicle) for vehicle in available_vehicles]

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
        "mileage": vehicle.mileage,
        "vehicle_model": vehicle.vehicle_model,
        "image_url": vehicle.image_url,
        "lease_expiry": vehicle.lease_expiry,
        "department_id": vehicle.department_id,
        "canDelete": can_delete,
        "is_archived": vehicle.is_archived, 
        "archived_at": vehicle.archived_at,
        "mileage_last_updated": vehicle.mileage_last_updated
    }

def update_vehicle(vehicle_id: str, vehicle_data: VehicleUpdateRequest, db: Session, user_id: UUID):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="רכב לא נמצא")
    if vehicle.is_archived:
        raise HTTPException(status_code=400, detail="לא ניתן לערוך רכב מארכב")
    if hasattr(vehicle_data, 'department_id'):
        if vehicle_data.department_id is None or vehicle_data.department_id == '':
            vehicle.department_id = None
        elif isinstance(vehicle_data.department_id, str) and vehicle_data.department_id.lower() == "null":
            vehicle.department_id = None
        else:
            from ..models.department_model import Department
            dept = db.query(Department).filter(
                Department.id == vehicle_data.department_id,
            ).first()
            if not dept:
                raise HTTPException(status_code=400, detail="מחלקה לא נמצאה או לא פעילה")
            vehicle.department_id = vehicle_data.department_id
    if vehicle_data.mileage is not None:
        if vehicle_data.mileage < 0:
            raise HTTPException(status_code=400, detail="קילומטראז' לא יכול להיות שלילי")
        if vehicle_data.mileage > 2147483647:
            raise HTTPException(status_code=400, detail="קילומטראז' גבוה מדי (מקסימום: 2,147,483,647)")
        vehicle.mileage = vehicle_data.mileage
        vehicle.mileage_last_updated = datetime.utcnow()
    if vehicle_data.image_url is not None:
        vehicle.image_url = vehicle_data.image_url
    if hasattr(vehicle, 'updated_at'):
        vehicle.updated_at = datetime.utcnow()
    try:
        db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user_id)})     
        db.commit()
        db.refresh(vehicle)
        db.execute(text("SET session.audit.user_id = DEFAULT"))
        return get_vehicle_by_id(vehicle_id, db)
    except Exception as e:
        db.rollback()
        db.execute(text("SET session.audit.user_id = DEFAULT"))
        raise HTTPException(status_code=500, detail=f"שגיאה בעדכון הרכב: {str(e)}")

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


def get_available_vehicles_by_type_and_time(
    db: Session,
    vehicle_type: str,
    start_datetime: datetime,
    end_datetime: datetime,
) -> List[Vehicle]:

    query = db.query(Vehicle).filter(
        Vehicle.type == vehicle_type,
        Vehicle.status == VehicleStatus.available,
    )
    
    conflicting_rides_subquery = db.query(Ride.vehicle_id).filter(
        or_(
            and_(
                Ride.start_datetime <= end_datetime,
                Ride.end_datetime >= start_datetime,
            )
        ),
        Ride.status != "cancelled",
    ).subquery()
    
    query = query.filter(~Vehicle.id.in_(conflicting_rides_subquery))
    
    vehicles = query.all()
    return vehicles


async def delete_vehicle(vehicle_id: UUID, db: Session, user_id: UUID):
    db: Session = SessionLocal()
    try:
        vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
        if not vehicle:
            return {"error": "Vehicle not found"}

        db.query(AuditLog).filter(AuditLog.entity_id == str(vehicle_id)).delete()

        db.query(MonthlyVehicleUsage).filter(MonthlyVehicleUsage.vehicle_id == vehicle_id).delete()
        db.query(Notification).filter(Notification.vehicle_id == vehicle_id).delete()
        db.query(VehicleInspection).filter(VehicleInspection.vehicle_id == vehicle_id).delete()

        rides = db.query(Ride).filter(Ride.vehicle_id == vehicle_id).all()

        cancel_future_rides_for_vehicle(vehicle_id=vehicle_id,db=db,admin_id=user_id)

        for ride in rides:
            ride.vehicle_id=None

        db.delete(vehicle)
        db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user_id)})
        db.commit()

        return {"message": "Vehicle and all related data deleted successfully."}

    except Exception as e:
        db.rollback()
        print(f"Exception in delete_vehicle: {e}")
        return {"error": str(e)}
    finally:
        db.close()



async def get_inactive_vehicles():
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        one_week_ago = now - timedelta(days=7)

        all_vehicles = db.query(Vehicle).all()

        recent_rides_subq = db.query(
            Ride.vehicle_id,
            func.max(Ride.end_datetime).label("last_ride")
        ).filter(
            Ride.status == "completed"
        ).group_by(Ride.vehicle_id).subquery()

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

    has_related_data = db.execute(
        text("SELECT EXISTS (SELECT 1 FROM rides WHERE vehicle_id = :vehicle_id)"),
        {"vehicle_id": str(vehicle_id)}
    ).scalar()

    if not has_related_data:
        raise HTTPException(status_code=400, detail="לא ניתן לארכב רכב ללא נסיעות.")

    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user_id)})

    vehicle.is_archived = True
    vehicle.archived_at = datetime.utcnow()
    db.commit()

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

