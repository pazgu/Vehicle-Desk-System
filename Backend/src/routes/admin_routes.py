import pandas as pd
from datetime import datetime, time, date, timedelta, timezone
from typing import Optional, List, Dict, Any
from uuid import UUID
import calendar


from fastapi import (
    APIRouter, 
    Depends, 
    HTTPException, 
    Query, 
    Header, 
    Request, 
    status, 
    UploadFile, 
    File, 
    Form, 
    Path, 
    Body
)
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer
from fastapi.staticfiles import StaticFiles
from sqlalchemy import and_, or_, desc, func, text ,case
from sqlalchemy.orm import Session, aliased
from ..helpers.department_helpers import get_or_create_vip_department
from src.schemas.ride_requirements_schema import RideRequirementOut, RideRequirementUpdate 
from src.services.ride_requirements import get_latest_requirement,create_requirement
# Utils
from ..utils.auth import get_current_user, token_check, role_check
from ..utils.database import get_db
from ..utils.socket_manager import sio
from src.utils.stats import generate_monthly_vehicle_usage

# Services
from src.services import admin_service, department_service 
from src.services.department_service import delete_department
from src.services.admin_rides_service import (
    get_all_orders,
    get_future_orders,
    get_past_orders,
    get_orders_by_user,
    get_order_by_ride_id,
    get_all_time_vehicle_usage_stats,
    get_critical_trip_issues,
    get_current_month_vehicle_usage,
    get_vehicle_usage_stats,
    get_critical_issue_by_id
)
from src.services.admin_user_service import create_user_by_admin, get_users_service
from src.services.audit_service import get_all_audit_logs
from src.services.license_service import upload_license_file_service, check_expired_licenses
from src.services.user_data import get_user_by_id, get_all_users
from ..services.admin_rides_service import get_critical_trip_issues, get_current_month_vehicle_usage, get_vehicle_usage_stats
from ..services.user_notification import send_admin_odometer_notification
from ..services.vehicle_service import (
    archive_vehicle_by_id,
    get_available_vehicles_for_ride_by_id,
    delete_vehicle
)

# Schemas
from src.schemas.audit_schema import AuditLogsSchema
from src.schemas.department_schema import DepartmentCreate, DepartmentUpdate, DepartmentOut
from src.schemas.order_card_item import OrderCardItem
from src.schemas.ride_dashboard_item import RideDashboardItem
from src.schemas.statistics_schema import (
    NoShowStatsResponse,
    TopNoShowUser,
    RideStartTimeStatsResponse,
    RideStartTimeBucket,
    PurposeOfTravelStatsResponse, 
    MonthlyPurposeBreakdown, 
)
from src.schemas.trip_completion_schema import RawCriticalIssueSchema, TripCompletionIssueSchema
from src.schemas.user_response_schema import UserResponse, PaginatedUserResponse
from src.schemas.vehicle_inspection_schema import VehicleInspectionOut
from ..schemas.check_vehicle_schema import VehicleInspectionSchema
from ..schemas.register_schema import UserCreate
from ..schemas.vehicle_schema import VehicleOut, InUseVehicleOut, VehicleStatusUpdate, MileageUpdateRequest

# Models
from src.models.department_model import Department
from src.models.ride_model import Ride, RideType
from src.models.user_model import User, UserRole
from src.models.vehicle_inspection_model import VehicleInspection
from src.models.vehicle_model import Vehicle
from ..models.no_show_events import NoShowEvent

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
router = APIRouter()

@router.get("/orders", response_model=list[RideDashboardItem])
def fetch_all_orders(
    status: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    return get_all_orders(db, status=status, from_date=from_date, to_date=to_date)

@router.get("/orders/future", response_model=list[RideDashboardItem])
def fetch_future_orders(
    status: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    return get_future_orders(db, status=status, from_date=from_date, to_date=to_date)

@router.get("/orders/past", response_model=list[RideDashboardItem])
def fetch_past_orders(
    status: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    return get_past_orders(db, status=status, from_date=from_date, to_date=to_date)

@router.get("/orders/user/{user_id}", response_model=list[RideDashboardItem])
def fetch_orders_by_user(user_id: UUID, db: Session = Depends(get_db)):
    return get_orders_by_user(db, user_id=user_id)

@router.get("/orders/ride/{ride_id}", response_model=RideDashboardItem)
def fetch_order_by_ride(ride_id: UUID, db: Session = Depends(get_db)):
    result = get_order_by_ride_id(db, ride_id=ride_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Ride not found")
    return result

@router.get("/user-data", response_model=List[UserResponse])
def fetch_all_users(db: Session = Depends(get_db)):
    users = get_all_users(db)
    if not users:
        raise HTTPException(status_code=404, detail="Users not found")
    return users

@router.get("/user-data/{user_id}", response_model=UserResponse)
def fetch_user_by_id(user_id: UUID, db: Session = Depends(get_db)):
    result = get_user_by_id(db, user_id=user_id)
    if result is None:
        raise HTTPException(status_code=404, detail="User not found")
    return result






@router.patch("/user-data-edit/{user_id}", response_model=UserResponse)
async def edit_user_by_id_route(
    user_id: UUID,
    first_name: str = Form(...),
    last_name: str = Form(...),
    username: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    role: Optional[str] = Form(None),
    department_id: Optional[str] = Form(None),
    has_government_license: str = Form(...),
    license_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    payload: dict = Depends(token_check),
    license_expiry_date: Optional[str] = Form(None),
    is_blocked: Optional[bool] = Form(False),
    block_expires_at: Optional[str] = Form(None),
    block_reason: Optional[str] = Form(None)
):
    user_id_from_token = payload.get("user_id") or payload.get("sub")
    user_role_from_token = payload.get("role")

    user = db.query(User).filter(User.employee_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user_id_from_token:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    if str(user_id) != user_id_from_token and user_role_from_token != UserRole.admin.value:
        raise HTTPException(status_code=403, detail="Not authorized to edit this user's data.")

    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user_id_from_token)})

    if department_id == "vip":
        vip_dep = get_or_create_vip_department(db, user_id_from_token)
        department_id = str(vip_dep.id)  

    has_gov_license = has_government_license.lower() == "true"

    if not has_gov_license and user.has_government_license:
        user.license_file_url = None
        user.license_expiry_date = None
    elif has_gov_license:
        if not user.license_file_url and license_file:
            try:
                contents = await license_file.read()
                filename = f"uploads/{license_file.filename}"
                with open(filename, "wb") as f:
                    f.write(contents)
                user.license_file_url = f"/{filename}"
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to save license file: {e}")
        elif user.license_file_url and license_file:
            raise HTTPException(
                status_code=403,
                detail="Government license file cannot be re-uploaded after initial upload."
            )
    if license_expiry_date and has_gov_license:
        try:
            user.license_expiry_date = datetime.strptime(license_expiry_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format for license_expiry_date. Expected YYYY-MM-DD.")
    elif not has_gov_license:
        user.license_expiry_date = None

    user.first_name = first_name
    user.last_name = last_name
    user.username = username
    user.email = email
    user.phone = phone
    user.has_government_license = has_gov_license
    user.is_blocked = is_blocked
    if is_blocked:
        if not block_reason or len(block_reason.strip()) < 5:
            raise HTTPException(
                status_code=400,
                detail="Block reason is required when blocking a user (at least 5 characters)."
            )
        user.block_reason = block_reason.strip()
    else:
        user.block_reason = None
        user.block_expires_at = None

    if block_expires_at:
        try:
            user.block_expires_at = datetime.strptime(block_expires_at, "%Y-%m-%dT%H:%M")
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid date-time format for block_expires_at. Expected YYYY-MM-DDTHH:MM."
            )
     
    if not is_blocked and role:
        try:
            new_role = UserRole(role)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid role provided: {role}. Must be one of: {', '.join([r.value for r in UserRole])}"
            )
        user.role = new_role

        if new_role == UserRole.admin or new_role == UserRole.inspector:
            user.department_id = None
        elif new_role == UserRole.supervisor:
            if department_id:
                try:
                    user.department_id = UUID(department_id)
                    user.is_unassigned_user = False
                except ValueError:
                    raise HTTPException(
                        status_code=400,
                        detail="Invalid department ID format. Must be a valid UUID."
                    )
            else:
                user.department_id = None
        else:
            if not department_id or not department_id.strip():
                raise HTTPException(status_code=400, detail=f"Department ID is required for role '{new_role}'.")
            try:
                user.department_id = UUID(department_id)
                user.is_unassigned_user = False
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid department ID format. Must be a valid UUID."
                )
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update user due to a database error.")

    db.refresh(user)

    
    await sio.emit('user_block_status_updated', {
        "id": str(user.employee_id),
        "is_blocked": user.is_blocked,
        "block_expires_at": user.block_expires_at.isoformat() if user.block_expires_at else None,
        "block_reason": user.block_reason or None
    })

    await sio.emit('user_license_updated', {
        "id": str(user.employee_id),
        "license_expiry_date": user.license_expiry_date.isoformat() if user.license_expiry_date else None,
        "has_government_license": bool(user.has_government_license),
        "license_file_url": user.license_file_url or ""
    })

    db.execute(text("SET session.audit.user_id = DEFAULT"))
    return user


@router.get("/roles")
def get_roles():
    return [role.value for role in UserRole]

@router.get("/no-show-events/count")
def get_no_show_events_count_per_user(db: Session = Depends(get_db)):
    results = (
        db.query(
            User.employee_id,
            User.username,
            User.email,
            User.role,
            Vehicle.plate_number
        )
        .join(NoShowEvent, User.employee_id == NoShowEvent.user_id)
        .join(Ride, Ride.id == NoShowEvent.ride_id)
        .join(Vehicle, Vehicle.id == Ride.vehicle_id)
        .all()
    )

    user_data = {}

    for row in results:
        emp_id = row.employee_id
        if emp_id not in user_data:
            user_data[emp_id] = {
                "employee_id": emp_id,
                "name": row.username,
                "email": row.email,
                "role": row.role,
                "no_show_count": 0,
                "plate_numbers": set()
            }

        user_data[emp_id]["no_show_count"] += 1
        user_data[emp_id]["plate_numbers"].add(row.plate_number)

    formatted_users = []
    for data in user_data.values():
        data["plate_numbers"] = list(data["plate_numbers"])
        formatted_users.append(data)

    return {"users": formatted_users}


@router.get("/no-show-events/recent")
def get_recent_no_show_events_per_user(
    per_user_limit: int = Query(1, ge=1, le=3),
    db: Session = Depends(get_db)
):
    row_number = func.row_number().over(
        partition_by=NoShowEvent.user_id,
        order_by=NoShowEvent.occurred_at.desc()
    ).label("rn")

    subq = (
        db.query(
            NoShowEvent.id.label("event_id"),
            NoShowEvent.user_id,
            NoShowEvent.ride_id,
            NoShowEvent.occurred_at,
            row_number
        ).subquery()
    )

    results = (
        db.query(
            subq.c.event_id,
            subq.c.user_id,
            subq.c.ride_id,
            subq.c.occurred_at,
            Vehicle.plate_number
        )
        .join(Ride, Ride.id == subq.c.ride_id)
        .join(Vehicle, Vehicle.id == Ride.vehicle_id)
        .filter(subq.c.rn <= per_user_limit)
        .all()
    )

    events = [
        {
            "event_id": row.event_id,
            "user_id": row.user_id,
            "ride_id": row.ride_id,
            "occurred_at": row.occurred_at.isoformat(),
            "plate_number": row.plate_number
        }
        for row in results
    ]

    return {
        "per_user_limit": per_user_limit,
        "events": events
    }

@router.post("/add-user", status_code=status.HTTP_201_CREATED)
async def add_user_as_admin(

    request: Request,
    first_name: str = Form(...),
    last_name: str = Form(...),
    username: str = Form(...),
    email: str = Form(...),
    phone: str = Form(None),
    role: str = Form(...),
    department_id: Optional[str] = Form(None),
    password: str = Form(...),
    has_government_license: bool = Form(...),
    license_file: UploadFile = File(None),
    db: Session = Depends(get_db),
    license_expiry_date: Optional[str] = Form(None)


):
    current_user = get_current_user(request)
    changed_by = current_user.employee_id

    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")
    
    license_file_url = None
    if has_government_license and license_file:
        contents = await license_file.read()
        with open(f"uploads/{license_file.filename}", "wb") as f:
            f.write(contents)
        license_file_url = f"/uploads/{license_file.filename}"

    if department_id and department_id.lower() == "vip":
        dep = get_or_create_vip_department(db, changed_by)
        department_id=dep.id

    user_data = UserCreate(
        first_name=first_name,
        last_name=last_name,
        username=username,
        email=email,
        phone=phone,
        role=role,
        department_id=department_id,
        password=password,
        has_government_license=has_government_license,
        license_file_url=license_file_url,
        license_expiry_date= license_expiry_date
    )

   
    result = create_user_by_admin(user_data, changed_by, db)

    
    
    return result

@router.get("/{ride_id}/available-vehicles", response_model=List[VehicleOut])
def available_vehicles_for_ride(
    ride_id: UUID,
    db: Session = Depends(get_db)
):
    try:
        return get_available_vehicles_for_ride_by_id(db, ride_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.get("/vehicles", response_model=List[VehicleOut])
def get_filtered_vehicles(
    status: Optional[str] = Query(None),
    vehicle_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    role_check(["admin"], token)

    query = db.query(Vehicle)

    if status:
        query = query.filter(Vehicle.status == status)

    if vehicle_type:
        query = query.filter(Vehicle.type.ilike(vehicle_type))

    return query.all()




@router.post("/notifications/admin", include_in_schema=True)
async def send_admin_notification_simple_route(db: Session = Depends(get_db)):
    vehicles = db.query(Vehicle).all()

    if not vehicles:
        raise HTTPException(status_code=404, detail="No vehicles found.")

    all_notifications = []

    for vehicle in vehicles:
        notifications = await send_admin_odometer_notification(vehicle.id, vehicle.mileage)

        if notifications:
            all_notifications.extend(notifications)

    if not all_notifications:
        raise HTTPException(status_code=204, detail="No admins found or odometer below threshold for all vehicles.")

    return {
        "detail": "Notifications sent",
        "count": len(all_notifications),
        "vehicles_checked": len(vehicles),
    }


@router.get("/inspections/today", response_model=List[RawCriticalIssueSchema])
def get_today_inspections(
    problem_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    today_start = datetime.combine(date.today(), datetime.min.time())
    tomorrow_start = today_start + timedelta(days=1)

    query = db.query(VehicleInspection).filter(
        VehicleInspection.inspection_date >= today_start,
        VehicleInspection.inspection_date < tomorrow_start
    )

    if problem_type == "medium":
        query = query.filter(
            and_(
                or_(
                    VehicleInspection.clean == False,
                    VehicleInspection.fuel_checked == False,
                    VehicleInspection.no_items_left == False
                ),
                VehicleInspection.critical_issue_bool == False
            )
        )
    elif problem_type == "critical":
        query = query.filter(
            or_(
                VehicleInspection.critical_issue_bool == True,
                and_(
                    VehicleInspection.issues_found != None,
                    VehicleInspection.issues_found != ""
                )
            )
        )
    elif problem_type == "medium,critical":
        query = query.filter(
            or_(
                and_(
                    or_(
                        VehicleInspection.clean == False,
                        VehicleInspection.fuel_checked == False,
                        VehicleInspection.no_items_left == False
                    ),
                    VehicleInspection.critical_issue_bool == False
                ),
                or_(
                    VehicleInspection.critical_issue_bool == True,
                    and_(
                        VehicleInspection.issues_found != None,
                        VehicleInspection.issues_found != ""
                    )
                )
            )
        )

    inspections = query.order_by(VehicleInspection.inspection_date.desc()).all()

    response_data = []
    for insp in inspections:
        response_data.append({
            "inspection_id": str(insp.inspection_id),
            "ride_id": None,
            "submitted_by": str(insp.inspected_by), 
            "role": "inspector",
            "type": "inspector",   
            "status": "critical" if insp.critical_issue_bool else "medium",
            "severity": "critical" if insp.critical_issue_bool else "medium",
            "issue_description": insp.issues_found,
            "issue_text": insp.issues_found,
            "timestamp": insp.inspection_date,
            "vehicle_id": None,
            "vehicle_info": f"רכב:",
            "inspection_details": {
                "clean": insp.clean,
                "fuel_checked": insp.fuel_checked,
                "no_items_left": insp.no_items_left,
                "issues_found": insp.issues_found,
            }
        })

    return response_data



@router.get("/analytics/vehicle-status-summary")
def vehicle_status_summary(
    db: Session = Depends(get_db),
    type: Optional[str] = Query(None, alias="type")
):
    try:
        query = db.query(Vehicle.status, func.count(Vehicle.id).label("count"))

        if type:
            query = query.filter(Vehicle.type == type)

        result = query.group_by(Vehicle.status).all()

        summary = [{"status": row.status.value, "count": row.count} for row in result]
        return JSONResponse(content=summary)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching summary: {str(e)}")

@router.get("/analytics/ride-status-summary")
def ride_status_summary(status: str = None, db: Session = Depends(get_db)):
    try:
        query = db.query(Ride.status, func.count(Ride.id).label("count"))
        if status:
            query = query.filter(Ride.status == status)
        result = query.group_by(Ride.status).all()
        summary = [{"status": row.status.value, "count": row.count} for row in result]
        return JSONResponse(content=summary)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching ride summary: {str(e)}")




@router.get("/all-audit-logs", response_model=List[AuditLogsSchema])
def get_all_audit_logs_route(
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    problematic_only: bool = Query(False, alias="problematicOnly"),
    db: Session = Depends(get_db),
    payload: dict = Depends(token_check)
):
    try:
        return get_all_audit_logs(db, from_date=from_date, to_date=to_date, problematic_only=problematic_only)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.get("/vehicles/usage-stats")
def vehicle_usage_stats(
    range: str = Query("month"),
    year: Optional[int] = Query(None, ge=2000, le=2100),
    month: Optional[int] = Query(None, ge=1, le=12),
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    role_check(["admin"], token)

    if range == "all":
        try:
            stats = get_all_time_vehicle_usage_stats(db)
            return {"range": "all", "stats": stats}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch all-time usage stats: {str(e)}")

    if not year or not month:
        raise HTTPException(status_code=400, detail="Missing year or month for monthly stats.")

    try:
        generate_monthly_vehicle_usage(db, year, month)  

        stats = get_vehicle_usage_stats(db, year, month)
        return {
            "year": year,
            "month": month,
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch monthly stats: {str(e)}")


@router.get("/analytics/top-used-vehicles")
def get_top_used_vehicles(db: Session = Depends(get_db)):
    try:
        results = (
            db.query(
                Vehicle.plate_number,
                Vehicle.vehicle_model,
                func.count(Ride.id).label("ride_count")
            )
            .join(Ride, Ride.vehicle_id == Vehicle.id)
            .group_by(Vehicle.plate_number, Vehicle.vehicle_model)
            .order_by(func.count(Ride.id).desc())
            .limit(10)
            .all()
        )

        return [
            {
                "plate_number": r.plate_number,
                "vehicle_model": r.vehicle_model,
                "ride_count": r.ride_count
            }
            for r in results
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"שגיאה בעת טעינת נסיעות לפי רכב: {str(e)}")

@router.get("/api/vehicle-usage-stats", response_model=List[dict])
def get_vehicle_usage_current_month(db: Session = Depends(get_db)):
    stats = get_current_month_vehicle_usage(db)

    if not stats:
        raise HTTPException(status_code=404, detail="No usage stats found for the current month")

    return stats


@router.get("/users", response_model=PaginatedUserResponse)
def get_all_users_route(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    role: Optional[UserRole] = None,
    search: Optional[str] = None
):
    return get_users_service(db=db, page=page, page_size=page_size, role=role, search=search)


@router.delete("/user-data/{user_id}")
def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        return admin_service.delete_user_by_id(user_id, current_user, db)
    except HTTPException as e:
        raise e
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.post("/api/users/{user_id}/license")
def upload_user_license_route(
    user_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    return upload_license_file_service(db=db, user_id=user_id, file=file)


@router.post("/admin/force-expired-license-check")
def force_license_check(db: Session = Depends(get_db)):
    return check_expired_licenses(db)


@router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle_route(
    request: Request,
    vehicle_id: UUID,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    user = get_current_user(request)
    role_check(["admin"], token)

    result = await delete_vehicle(vehicle_id, db, user.employee_id)

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result

@router.post("/vehicles/{vehicle_id}/archive")
def archive_vehicle(
    request: Request,
    vehicle_id: UUID,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    user = get_current_user(request)
    role_check(["admin"], token)
    return archive_vehicle_by_id(vehicle_id, db, user.employee_id)

@router.get("/archived-vehicles", response_model=List[VehicleOut])
def get_archived_vehicles(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    role_check(["admin"], token)

    vehicles = (
        db.query(Vehicle)
        .filter(Vehicle.is_archived == True)
        .all()
    )

    result = []
    for v in vehicles:
        data = VehicleOut.from_orm(v).dict()
        data["canDelete"] = False

        if v.archived_at:
            if isinstance(v.archived_at, time):
                archived_at_dt = datetime.combine(datetime.today(), v.archived_at)
            else:
                archived_at_dt = v.archived_at

            archive_age = (datetime.now(timezone.utc) - archived_at_dt).days
            if archive_age >= 90:
                data["canDelete"] = True

        result.append(data)

    return result

@router.delete("/vehicles/{vehicle_id}/delete-archived")
def delete_archived_vehicle(
    vehicle_id: UUID,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    role_check(["admin"], token)

    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id, Vehicle.is_archived == True).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Archived vehicle not found")

    if not vehicle.archived_at or (datetime.now() - vehicle.archived_at).days < 90:
        raise HTTPException(status_code=403, detail="Cannot delete vehicle before 3 months of archiving")

    db.delete(vehicle)
    db.commit()
    return {"message": "Vehicle permanently deleted"}

@router.get("/critical-trip-issues", response_model=List[TripCompletionIssueSchema])
def fetch_critical_trip_issues(db: Session = Depends(get_db)):
    return get_critical_trip_issues(db)

@router.get("/critical-issues/{issue_id}",response_model=RawCriticalIssueSchema)
def get_critical_issue_details(issue_id: str, db: Session = Depends(get_db)):
    """
    Get detailed information about a specific critical issue
    """
    try:
        issue_details = get_critical_issue_by_id(issue_id, db)
        if not issue_details:
            raise HTTPException(status_code=404, detail="Critical issue not found")

        return issue_details  
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch issue details: {str(e)}")



@router.get("/critical-issues", response_model=Dict[str, List[Any]])
def get_critical_issues(
    problem_type: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    UserAlias = aliased(User)
    inspections_query = db.query(
        VehicleInspection,
        UserAlias.username.label("inspected_by_name"),
        Vehicle.plate_number.label("plate_number")
    ).outerjoin(
        UserAlias, VehicleInspection.inspected_by == UserAlias.employee_id
    ).outerjoin(
        Vehicle, VehicleInspection.vehicle_id == Vehicle.id
    )

    rides_query = db.query(
        Ride,
        Vehicle.freeze_details
    ).join(
        Vehicle, Ride.vehicle_id == Vehicle.id
    ).filter(Ride.emergency_event == "true")
    rides = rides_query.all()

    rides_data = []
    for ride, freeze_details in rides:
        ride_dict = OrderCardItem.from_orm(ride).model_dump()
        ride_dict["freeze_details"] = freeze_details
        rides_data.append(ride_dict)

        
    if problem_type == "medium":
        inspections_query = inspections_query.filter(
            and_(
                or_(
                    VehicleInspection.clean == False,
                    VehicleInspection.fuel_checked == False,
                    VehicleInspection.no_items_left == False
                ),
                VehicleInspection.critical_issue_bool == False
            )
        )
        rides_data = []

    elif problem_type == "critical":
        inspections_query = inspections_query.filter(
            or_(
                VehicleInspection.critical_issue_bool == True,
                and_(
                    VehicleInspection.issues_found != None,
                    VehicleInspection.issues_found != ""
                )
            )
        )

    elif problem_type == "medium,critical":
        inspections_query = inspections_query.filter(
            or_(
                and_(
                    or_(
                        VehicleInspection.fuel_checked == False,
                    ),
                    VehicleInspection.critical_issue_bool == False
                ),
                or_(
                    VehicleInspection.critical_issue_bool == True,
                    and_(
                        VehicleInspection.issues_found != None,
                        VehicleInspection.issues_found != ""
                    )
                )
            )
        )


    inspections_query = inspections_query.order_by(VehicleInspection.inspection_date.desc())

    inspections = inspections_query.all()

    inspections_data = []

    for inspection, inspected_by_name, plate_number in inspections:
        data = VehicleInspectionOut.model_validate(inspection, from_attributes=True).model_dump()
        data.pop("inspected_by_name", None)
        out = VehicleInspectionOut(**data, inspected_by_name=inspected_by_name).model_dump()
        out["plate_number"] = plate_number
        inspections_data.append(out)

    return {
        "inspections": inspections_data,
        "rides": rides_data
    }

@router.get("/statistics/no-show", response_model=NoShowStatsResponse)
def get_no_show_statistics(
    from_date: Optional[datetime] = Query(None, description="Start date for filtering (inclusive)"),
    to_date: Optional[datetime] = Query(None, description="End date for filtering (inclusive)"),
    page: int = Query(1, ge=1, description="Page number for pagination"),
    page_size: int = Query(10, ge=1, le=100, description="Page size for pagination"),
    db: Session = Depends(get_db),
):
    

    query = db.query(NoShowEvent)
    if from_date:
        query = query.filter(NoShowEvent.occurred_at >= from_date)
    if to_date:
        query = query.filter(NoShowEvent.occurred_at <= to_date)

    total_no_show_events = query.count()
    unique_no_show_users = query.with_entities(NoShowEvent.user_id).distinct().count()

    completed_query = db.query(Ride).filter(
        Ride.status == "completed",
        Ride.completion_date != None)
    if from_date:
        completed_query = completed_query.filter(Ride.completion_date >= from_date)
    if to_date:
        completed_query = completed_query.filter(Ride.completion_date <= to_date)

    completed_rides_count = completed_query.count()

    offset = (page - 1) * page_size
    top_users_query = (
    db.query(
        NoShowEvent.user_id,
        func.concat(User.first_name, ' ', User.last_name).label("name"),
        Department.id.label("department_id"),
        func.count(NoShowEvent.id).label("count"),
        User.email,
        User.role,
        User.employee_id,
    )
    .outerjoin(User, User.employee_id == NoShowEvent.user_id)
    .outerjoin(Department, Department.id == User.department_id)
    .filter(NoShowEvent.occurred_at >= from_date if from_date else True)
    .filter(NoShowEvent.occurred_at <= to_date if to_date else True)
    .group_by(
        NoShowEvent.user_id,
        User.first_name,
        User.last_name,
        Department.id,
        User.email,
        User.role,
        User.employee_id,
    )
    .order_by(desc("count"))
    .offset(offset)
    .limit(page_size)
    .all()
)

    top_no_show_users = [
    TopNoShowUser(
        user_id=str(row.employee_id),
        name=row.name,
        department_id=row.department_id,
        count=row.count,
        email=row.email,
        role=row.role,
        employee_id=str(row.employee_id),
    )
    for row in top_users_query
]

    return NoShowStatsResponse(
        total_no_show_events=total_no_show_events,
        unique_no_show_users=unique_no_show_users,
        completed_rides_count=completed_rides_count,
        top_no_show_users=top_no_show_users
    )


@router.get("/statistics/ride-start-time", response_model=RideStartTimeStatsResponse)
def get_ride_start_time_statistics(
    from_date: Optional[date] = Query(
        None,
        description="Start date for filtering (inclusive, YYYY-MM-DD)",
    ),
    to_date: Optional[date] = Query(
        None,
        description="End date for filtering (inclusive, YYYY-MM-DD)",
    ),
    db: Session = Depends(get_db),
):
    
    today = date.today()

    if to_date is None:
        if today.month == 12:
            next_month = date(today.year + 1, 1, 1)
        else:
            next_month = date(today.year, today.month + 1, 1)
        to_date = next_month - timedelta(days=1)

    if from_date is None:
        month = to_date.month - 3
        year = to_date.year
        while month <= 0:
            month += 12
            year -= 1
        from_date = date(year, month, 1)

    start_dt = datetime.combine(from_date, time.min)
    end_dt = datetime.combine(to_date, time.max)

    base_query = db.query(Ride).filter(
        Ride.start_datetime >= start_dt,
        Ride.start_datetime <= end_dt,
    )
    total_rides = base_query.count()

    hour_col = func.extract("hour", Ride.start_datetime).label("hour")

    grouped = (
        db.query(hour_col, func.count(Ride.id).label("ride_count"))
        .filter(
            Ride.start_datetime >= start_dt,
            Ride.start_datetime <= end_dt,
        )
        .group_by(hour_col)
        .order_by(hour_col)
        .all()
    )

    counts_by_hour = {int(row.hour): row.ride_count for row in grouped}

    buckets = [
        RideStartTimeBucket(hour=h, ride_count=counts_by_hour.get(h, 0))
        for h in range(24)
    ]

    return RideStartTimeStatsResponse(
        from_date=from_date,
        to_date=to_date,
        total_rides=total_rides,
        buckets=buckets,
    )

@router.get("/statistics/purpose-of-travel", response_model=PurposeOfTravelStatsResponse)
def get_purpose_of_travel_statistics(
    from_year: Optional[int] = Query(
        None, description="Start year of the range (inclusive)"
    ),
    from_month: Optional[int] = Query(
        None, ge=1, le=12, description="Start month of the range (1–12, inclusive)"
    ),
    to_year: Optional[int] = Query(
        None, description="End year of the range (inclusive)"
    ),
    to_month: Optional[int] = Query(
        None, ge=1, le=12, description="End month of the range (1–12, inclusive)"
    ),
    db: Session = Depends(get_db),
):

    today = date.today()

    if from_year is None or from_month is None or to_year is None or to_month is None:
        to_year = today.year
        to_month = today.month

        fy = to_year
        fm = to_month
        for _ in range(3):
            fm -= 1
            if fm == 0:
                fm = 12
                fy -= 1

        from_year = fy
        from_month = fm

    if (from_year, from_month) > (to_year, to_month):
        raise HTTPException(
            status_code=400,
            detail="from_year/from_month cannot be after to_year/to_month.",
        )

    from_date = date(from_year, from_month, 1)

    last_day_of_to_month = calendar.monthrange(to_year, to_month)[1]
    to_date = date(to_year, to_month, last_day_of_to_month)

    start_dt = datetime.combine(from_date, datetime.min.time())
    end_dt = datetime.combine(to_date, datetime.max.time())

    month_start = func.date_trunc("month", Ride.start_datetime).label("month_start")

    grouped = (
        db.query(
            month_start,
            Ride.ride_type,
            func.count(Ride.id).label("count"),
        )
        .filter(
            Ride.start_datetime >= start_dt,
            Ride.start_datetime <= end_dt,
        )
        .group_by(month_start, Ride.ride_type)
        .order_by(month_start)
        .all()
    )

    def iter_months(y1: int, m1: int, y2: int, m2: int):
        y, m = y1, m1
        while (y < y2) or (y == y2 and m <= m2):
            yield y, m
            if m == 12:
                y += 1
                m = 1
            else:
                m += 1

    months_map = {}
    for y, m in iter_months(from_year, from_month, to_year, to_month):
        months_map[(y, m)] = {
            "administrative": 0,
            "operational": 0,
        }

    for row in grouped:
        dt = row.month_start
        y = dt.year
        m = dt.month

        if (y, m) not in months_map:
            months_map[(y, m)] = {
                "administrative": 0,
                "operational": 0,
            }

        ride_type_value = (
            row.ride_type.value if hasattr(row.ride_type, "value") else str(row.ride_type)
        )

        if ride_type_value == "administrative":
            months_map[(y, m)]["administrative"] += row.count
        elif ride_type_value == "operational":
            months_map[(y, m)]["operational"] += row.count
        else:
            continue

    months_output: List[MonthlyPurposeBreakdown] = []
    total_rides_all = 0

    for (y, m) in sorted(months_map.keys()):
        admin_count = months_map[(y, m)]["administrative"]
        op_count = months_map[(y, m)]["operational"]
        total = admin_count + op_count
        total_rides_all += total

        if total > 0:
            admin_pct = round(admin_count * 100.0 / total, 1)
            op_pct = round(op_count * 100.0 / total, 1)
        else:
            admin_pct = 0.0
            op_pct = 0.0

        months_output.append(
            MonthlyPurposeBreakdown(
                year=y,
                month=m,
                month_label=f"{m}/{y}", 
                administrative_count=admin_count,
                operational_count=op_count,
                total_rides=total,
                administrative_percentage=admin_pct,
                operational_percentage=op_pct,
            )
        )

    return PurposeOfTravelStatsResponse(
        from_year=from_year,
        from_month=from_month,
        to_year=to_year,
        to_month=to_month,
        total_rides=total_rides_all,
        months=months_output,
    )

@router.post("/admin/vehicles/mileage/upload")
async def upload_mileage_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
    payload: dict = Depends(token_check)
):
    user_id_from_token = payload.get("user_id") or payload.get("sub")

    role_check(["admin"], token)
    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user_id_from_token)})


    if not file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="File must be .xlsx format")

    try:
        df = pd.read_excel(file.file)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {e}")

    required_columns = {"Vehicle ID", "Vehicle Name", "Mileage"}
    if not required_columns.issubset(set(df.columns)):
        raise HTTPException(
            status_code=400,
            detail=f"Excel is missing one of the required columns: {required_columns}"
        )

    success = []
    errors = []

    for index, row in df.iterrows():
        row_number = index + 2 

        try:
            vehicle_id = UUID(str(row["Vehicle ID"]))
            mileage = row["Mileage"]
            name = row.get("Vehicle Name", "Unknown")
        except Exception:
            errors.append({
                "row": row_number,
                "error": "Invalid UUID or data format",
                "name": row.get("Vehicle Name", "Unknown")
            })
            continue

        if not isinstance(mileage, (int, float)) or mileage < 0:
            errors.append({
                "row": row_number,
                "vehicle_id": str(vehicle_id),
                "error": f"Invalid mileage: {mileage}"
            })
            continue

        vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
        if not vehicle:
            errors.append({
                "row": row_number,
                "vehicle_id": str(vehicle_id),
                "error": "Vehicle not found",
                "name": name
            })
            continue

        vehicle.mileage = int(mileage)
        vehicle.mileage_last_updated = datetime.utcnow()

        success.append({
            "row": row_number,
            "vehicle_id": str(vehicle_id),
            "name": name,
            "new_mileage": int(mileage)
        })

    db.commit()
    db.execute(text("SET session.audit.user_id = DEFAULT"))

    return {
        "updated": success,
        "errors": errors
    }

    
@router.patch("/vehicles/{vehicle_id}/mileage")
def manual_mileage_edit(
    vehicle_id: UUID = Path(..., description="Vehicle UUID"),
    request: MileageUpdateRequest = Body(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(current_user.employee_id)})


    if request.new_mileage < vehicle.mileage:
        raise HTTPException(
            status_code=400,
            detail=f"קריאת הקילומטרים החדשה ({request.new_mileage}) אינה יכולה להיות פחות מזו לפניה ({vehicle.mileage})"
        )

    vehicle.mileage = request.new_mileage
    vehicle.mileage_last_updated = datetime.utcnow()

    db.commit()

    db.execute(text("SET session.audit.user_id = DEFAULT"))


    return {
        "message": "Mileage updated successfully",
        "vehicle_id": str(vehicle.id),
        "new_mileage": request.new_mileage
    }
@router.get("/all/supervisors", response_model=List[UserResponse])
def get_supervisors(db: Session = Depends(get_db)):
    supervisors = db.query(User).filter(User.role == UserRole.supervisor).all()
    return supervisors

@router.post("/departments", response_model=DepartmentOut, status_code=201)
def create_department(dept: DepartmentCreate, db: Session = Depends(get_db), payload: dict = Depends(token_check)):
    return department_service.create_department(db, dept, payload)

@router.patch("/departments/{department_id}", response_model=DepartmentOut)
def patch_department(department_id: UUID, dept: DepartmentUpdate, db: Session = Depends(get_db), payload: dict = Depends(token_check)):
    return department_service.update_department(db, department_id, dept, payload)


@router.delete("/departments/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_department_endpoint(
    dept_id: UUID,
    db: Session = Depends(get_db),
    payload: dict = Depends(token_check)
):
    return delete_department(db, dept_id, payload)



@router.get("/get-requirements", response_model=RideRequirementOut)
def get_requirements(db: Session = Depends(get_db), _: dict = Depends(get_current_user)):
    requirement = get_latest_requirement(db)
    if not requirement:
        return None
    return requirement


@router.post("/add-requirements", response_model=RideRequirementOut)
def update_requirements(
    data: RideRequirementUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    data.updated_by = current_user.employee_id
    updated = create_requirement(db, data)
    return updated


@router.put("/update-requirements", response_model=Optional[RideRequirementOut])
def update_requirements(
    data: RideRequirementUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Update the existing requirements (edit title/items)."""
    existing = get_latest_requirement(db)
    if not existing:
        raise HTTPException(status_code=404, detail="No requirements found to update.")

    existing.title = data.title
    existing.items = data.items
    existing.updated_by = current_user.employee_id
    existing.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(existing)
    return existing


