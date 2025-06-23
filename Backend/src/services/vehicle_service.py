from sqlalchemy.orm import Session
from sqlalchemy.types import String  # To cast to string
from typing import Optional, List , Dict , Union
from ..models.vehicle_model import Vehicle, VehicleStatus
from sqlalchemy import func, cast 
from sqlalchemy import and_ , or_ , not_ , select
from ..models.ride_model import Ride, RideStatus
from ..models.user_model import User
from datetime import datetime, timezone
from ..schemas.vehicle_schema import VehicleOut, InUseVehicleOut
from uuid import UUID
from sqlalchemy import text
from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError
from ..models.vehicle_inspection_model import VehicleInspection 
from ..schemas.check_vehicle_schema import VehicleInspectionSchema
from ..utils.audit_utils import log_action 
from ..schemas.user_rides_schema import RideSchema 

def vehicle_inspection_logic(data: VehicleInspectionSchema, db: Session):
    inspection = VehicleInspection(
        inspected_by=data.inspected_by,
        inspection_date=datetime.now(timezone.utc),
        clean=data.clean,
        fuel_checked=data.fuel_checked,
        no_items_left=data.no_items_left,
        critical_issue_bool=data.critical_issue_bool,
        issues_found=data.issues_found,
    )

    db.add(inspection)
    db.commit()
    db.refresh(inspection)

    return {
        "message": "Vehicle inspection recorded successfully",
        "inspection_id": str(inspection.inspection_id)
    }


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
            Vehicle.odometer_reading,
            Vehicle.vehicle_model,
            Vehicle.image_url,
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
    )

    if status:
        query = query.filter(Vehicle.status == status)

    
    if vehicle_type:  # ✅ Add this part to filter by type
        query = query.filter(func.lower(Vehicle.type) == vehicle_type.lower())


    vehicles = query.all()

    result = []
    for row in vehicles:
        data = dict(row._mapping)
        if data["status"] == VehicleStatus.in_use:
            result.append(InUseVehicleOut(**data))
        else:
            result.append(VehicleOut(**data))

    print("Result:", result)
    return result

def update_vehicle_status(vehicle_id: UUID, new_status: VehicleStatus, freeze_reason: str, db: Session, changed_by: UUID, notes: Optional[str] = None):
    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(changed_by)})
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    try:
        if new_status == VehicleStatus.frozen:
            if not freeze_reason:
                raise HTTPException(status_code=400, detail="freeze_reason is required when setting status to 'frozen'")
            vehicle.freeze_reason = freeze_reason

        elif vehicle.status == VehicleStatus.frozen and new_status != VehicleStatus.frozen:
            vehicle.freeze_reason = None

        vehicle.status = new_status
        db.commit()
        db.refresh(vehicle)
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

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
    return {
        "id": str(vehicle.id),
        "plate_number": vehicle.plate_number,
        "type": vehicle.type,
        "fuel_type": vehicle.fuel_type,
        "status": vehicle.status,
        "freeze_reason": vehicle.freeze_reason,
        "last_used_at": vehicle.last_used_at,
        "current_location": vehicle.current_location,
        "odometer_reading": vehicle.odometer_reading,
        "vehicle_model": vehicle.vehicle_model,
        "image_url": vehicle.image_url,
        "lease_expiry": vehicle.lease_expiry
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
