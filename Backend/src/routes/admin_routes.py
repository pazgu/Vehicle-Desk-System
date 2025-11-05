import pandas as pd
from datetime import datetime, time, date, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID

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
from sqlalchemy import and_, or_, desc, func, text
from sqlalchemy.orm import Session, aliased

# Utils
from ..utils.auth import get_current_user, token_check, role_check
from ..utils.database import get_db
from ..utils.socket_manager import sio
from src.utils.stats import generate_monthly_vehicle_usage

# Services
from src.services import admin_service, department_service 
from src.services.department_service import create_department, update_department, delete_department
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
from ..services.monthly_trip_counts import archive_last_month_stats
from ..services.user_notification import send_admin_odometer_notification
from ..services.vehicle_service import (
    archive_vehicle_by_id,
    get_available_vehicles_for_ride_by_id,
    delete_vehicle_by_id
)

# Schemas
from src.schemas.audit_schema import AuditLogsSchema
from src.schemas.department_schema import DepartmentCreate, DepartmentUpdate, DepartmentOut
from src.schemas.order_card_item import OrderCardItem
from src.schemas.ride_dashboard_item import RideDashboardItem
from src.schemas.statistics_schema import NoShowStatsResponse, TopNoShowUser
from src.schemas.trip_completion_schema import RawCriticalIssueSchema, TripCompletionIssueSchema
from src.schemas.user_response_schema import UserResponse, PaginatedUserResponse
from src.schemas.vehicle_inspection_schema import VehicleInspectionOut
from ..schemas.check_vehicle_schema import VehicleInspectionSchema
from ..schemas.register_schema import UserCreate
from ..schemas.vehicle_schema import VehicleOut, InUseVehicleOut, VehicleStatusUpdate, MileageUpdateRequest

# Models
from src.models.department_model import Department
from src.models.ride_model import Ride
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
    role: str = Form(...),
    department_id: str = Form(...),
    has_government_license: str = Form(...),
    license_file: UploadFile = File(None),
    db: Session = Depends(get_db),
    payload: dict = Depends(token_check),
    license_expiry_date: Optional[str] = Form(None),
    is_blocked: Optional[bool] = Form(False),
    block_expires_at: Optional[str] = Form(None)
):
    user_id_from_token = payload.get("user_id") or payload.get("sub")
    user_role_from_token = payload.get("role")
    # --- DEBUGGING LOGS END ---

    user = db.query(User).filter(User.employee_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user_id_from_token:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    # Authorization: User can edit their own data OR if they are an admin
    if str(user_id) != user_id_from_token and user_role_from_token != UserRole.admin.value:
        raise HTTPException(status_code=403, detail="Not authorized to edit this user's data.")

    # Set session audit user ID for database triggers/logging
    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user_id_from_token)})

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
        elif not user.license_file_url and not license_file:
            raise HTTPException(
                status_code=400, 
                detail="License file is required when enabling government license."
            )
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

    # --- Department ID and Role Logic ---
    try:
        new_role = UserRole(role) # Convert incoming string 'role' to UserRole enum
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role provided: {role}. Must be one of: {', '.join([r.value for r in UserRole])}")

    user.role = new_role # Assign the validated role

    if new_role == UserRole.admin:
        user.department_id = None
    else:
        if not department_id or not department_id.strip():
            raise HTTPException(status_code=400, detail=f"Department ID is required for role '{new_role}'.")
        try:
            user.department_id = UUID(department_id) # Convert string to UUID
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid department ID format. Must be a valid UUID.")
    # --- End Department ID Logic ---

    user.has_government_license = has_gov_license # Apply this if it's the final decision point

    # --- ADD THESE LINES TO UPDATE IS_BLOCKED AND BLOCK_EXPIRES_AT ---
    user.is_blocked = is_blocked # Assign the boolean value directly

    if block_expires_at: # If a date string was provided (not empty string or None)
        try:
            # Parse the string into a datetime object
            # Frontend sends YYYY-MM-DDTHH:MM (from toISOString().slice(0, 16))
            user.block_expires_at = datetime.strptime(block_expires_at, "%Y-%m-%dT%H:%M")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date-time format for block_expires_at. Expected YYYY-MM-DDTHH:MM.")
    else:
        user.block_expires_at = None # Set to None if no date string was provided (to unblock or clear expiry)


    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update user due to a database error.")

    db.refresh(user)

    
    await sio.emit('user_block_status_updated', {
        "id": str(user.employee_id),
        "is_blocked": user.is_blocked,
        "block_expires_at": user.block_expires_at.isoformat() if user.block_expires_at else None
    })

    await sio.emit('user_license_updated', {
        "id": str(user.employee_id),
        "license_expiry_date": user.license_expiry_date.isoformat() if user.license_expiry_date else None,
        "has_government_license": bool(user.has_government_license),
        "license_file_url": user.license_file_url or ""
    })


    # Reset session audit user ID
    db.execute(text("SET session.audit.user_id = DEFAULT"))
    return user


@router.get("/roles")
def get_roles():
    return [role.value for role in UserRole]

@router.get("/no-show-events/count")
def get_no_show_events_count_per_user(db: Session = Depends(get_db)):
    # Step 1: Query user + vehicle data
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

    # Step 2: Aggregate by user
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

    # Step 3: Convert sets to lists
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
    # Window function to get recent events per user
    row_number = func.row_number().over(
        partition_by=NoShowEvent.user_id,
        order_by=NoShowEvent.occurred_at.desc()
    ).label("rn")

    # Subquery with row numbers
    subq = (
        db.query(
            NoShowEvent.id.label("event_id"),
            NoShowEvent.user_id,
            NoShowEvent.ride_id,
            NoShowEvent.occurred_at,
            row_number
        ).subquery()
    )

    # Join subquery with Ride and Vehicle
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

    # Format result
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
    role_check(["admin"], token)  # Only admins can access this

    query = db.query(Vehicle)

    if status:
        query = query.filter(Vehicle.status == status)

    if vehicle_type:
        query = query.filter(Vehicle.type.ilike(vehicle_type))  # Case-insensitive match

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
            "submitted_by": str(insp.inspected_by),  # 👈 FRONT expects this!
            "role": "inspector",
            "type": "inspector",  # 👈 match RawCriticalIssue
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


# This function will be called later by another function with a GET route.
@router.post("/stats/archive-last-month")
def archive_last_month_endpoint(db: Session = Depends(get_db)):
    archive_last_month_stats(db)
    return {"detail": "Archiving completed successfully"}


@router.get("/analytics/vehicle-status-summary")
def vehicle_status_summary(
    db: Session = Depends(get_db),
    type: Optional[str] = Query(None, alias="type")  # 'type' from query param
):
    try:
        query = db.query(Vehicle.status, func.count(Vehicle.id).label("count"))

        if type:
            query = query.filter(Vehicle.type == type)

        result = query.group_by(Vehicle.status).all()

        # Format response
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
    problematic_only: bool = Query(False, alias="problematicOnly"),  # <-- add alias
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
    role_check(["admin"], token)  # רק מנהלים מורשים

    if range == "all":
        try:
            stats = get_all_time_vehicle_usage_stats(db)
            return {"range": "all", "stats": stats}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch all-time usage stats: {str(e)}")

    if not year or not month:
        raise HTTPException(status_code=400, detail="Missing year or month for monthly stats.")

    try:
        generate_monthly_vehicle_usage(db, year, month)  # ✅ This is the only line you need to add

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
def delete_vehicle(
    request: Request,  
    vehicle_id: UUID,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    user = get_current_user(request)
    role_check(["admin"], token)
    return delete_vehicle_by_id(vehicle_id, db, user.employee_id)  # ✅ not user.id

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

            archive_age = (datetime.now() - archived_at_dt).days
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

        return issue_details  # ✅ this line is now correctly indented
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
    

    # 1. Get total no-shows
    query = db.query(NoShowEvent)
    if from_date:
        query = query.filter(NoShowEvent.occurred_at >= from_date)
    if to_date:
        query = query.filter(NoShowEvent.occurred_at <= to_date)

    total_no_show_events = query.count()
    unique_no_show_users = query.with_entities(NoShowEvent.user_id).distinct().count()

    # 2. Get completed rides in same range
    completed_query = db.query(Ride).filter(
        Ride.status == "completed",
        Ride.completion_date != None)
    if from_date:
        completed_query = completed_query.filter(Ride.completion_date >= from_date)
    if to_date:
        completed_query = completed_query.filter(Ride.completion_date <= to_date)

    completed_rides_count = completed_query.count()

    # 3. Get top users with pagination
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




@router.post("/admin/vehicles/mileage/upload")
async def upload_mileage_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
    payload: dict = Depends(token_check)
):
    user_id_from_token = payload.get("user_id") or payload.get("sub")

    # בדיקת הרשאה – רק admin
    role_check(["admin"], token)
    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user_id_from_token)})


    # בדיקה שהקובץ הוא מסוג xlsx
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
        row_number = index + 2  # שורת כותרת באקסל היא מספר 1

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

        # עדכון הרכב
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
            detail=f"New mileage ({request.new_mileage}) cannot be less than current mileage ({vehicle.mileage})"
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