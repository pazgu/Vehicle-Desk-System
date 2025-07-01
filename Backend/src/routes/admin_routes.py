from fastapi import APIRouter, Depends, HTTPException, Query,Header, Request, status, UploadFile, File, Form
from uuid import UUID
from fastapi.staticfiles import StaticFiles
from typing import Optional , List
from datetime import datetime
from sqlalchemy.orm import Session
from src.schemas.user_response_schema import UserResponse, UserUpdate
from src.schemas.ride_dashboard_item import RideDashboardItem
from src.services.user_data import get_user_by_id, get_all_users
from src.services.admin_rides_service import (
    get_all_orders,
    get_future_orders,
    get_past_orders,
    get_orders_by_user,
    get_order_by_ride_id,
    get_all_time_vehicle_usage_stats 
)
from sqlalchemy import and_, or_
from ..utils.database import get_db
from src.models.user_model import User , UserRole
from src.models.vehicle_model import Vehicle
from ..schemas.check_vehicle_schema import VehicleInspectionSchema
from ..schemas.vehicle_schema import VehicleOut , InUseVehicleOut , VehicleStatusUpdate
from ..utils.auth import get_current_user, token_check
from ..services.vehicle_service import get_vehicles_with_optional_status,update_vehicle_status,get_vehicle_by_id, get_available_vehicles_for_ride_by_id
from ..services.user_notification import send_admin_odometer_notification
from datetime import date, datetime, timedelta
from src.models.vehicle_inspection_model import VehicleInspection
from ..services.monthly_trip_counts import archive_last_month_stats
from sqlalchemy import func, text
from fastapi.responses import JSONResponse
from src.models.ride_model import Ride
from sqlalchemy import cast, Date
from src.utils.stats import generate_monthly_vehicle_usage
from ..schemas.register_schema import UserCreate
from src.services import admin_service
from ..schemas.audit_schema import AuditLogsSchema
from src.services.audit_service import get_all_audit_logs
from ..utils.socket_manager import sio
from ..services.admin_rides_service import get_current_month_vehicle_usage ,  get_vehicle_usage_stats
from fastapi.security import OAuth2PasswordBearer
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
from ..utils.auth import role_check
from fastapi import HTTPException
from ..services.admin_user_service import create_user_by_admin , get_users_service
from ..schemas.user_response_schema import PaginatedUserResponse
from src.utils.auth import get_current_user
from ..services.license_service import upload_license_file_service 


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
    license_expiry_date: Optional[str] = Form(None)
):
    user = db.query(User).filter(User.employee_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_id_from_token = payload.get("user_id") or payload.get("sub")
    if not user_id_from_token:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user_id_from_token)})

    # Convert "true"/"false" string to actual boolean
    has_gov_license = has_government_license.lower() == "true"

    # Handle license expiry date
    if license_expiry_date:
        try:
            from datetime import datetime
            user.license_expiry_date = datetime.strptime(license_expiry_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format for license_expiry_date")

    # Handle license file if provided
    license_file_url = user.license_file_url
    if license_file:
        contents = await license_file.read()
        filename = f"uploads/{license_file.filename}"
        with open(filename, "wb") as f:
            f.write(contents)
        license_file_url = f"/{filename}"

    # Apply updates
    user.first_name = first_name
    user.last_name = last_name
    user.username = username
    user.email = email
    user.phone = phone
    user.role = role
    user.department_id = department_id
    user.has_government_license = has_gov_license
    user.license_file_url = license_file_url

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print("❌ Commit failed:", e)
        raise HTTPException(status_code=500, detail="Failed to update user")

    db.refresh(user)
    db.execute(text("SET session.audit.user_id = DEFAULT"))
    return user
@router.get("/roles")
def get_roles():
    return [role.value for role in UserRole]


@router.post("/add-user", status_code=status.HTTP_201_CREATED)
async def add_user_as_admin(

    request: Request,
    first_name: str = Form(...),
    last_name: str = Form(...),
    username: str = Form(...),
    email: str = Form(...),
    phone: str = Form(None),
    role: str = Form(...),
    department_id: str = Form(...),
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

    # 🔍 DEBUG: Log the received value and its type
    print(f"🔍 DEBUG: has_government_license = {has_government_license}")
    print(f"🔍 DEBUG: has_government_license type = {type(has_government_license)}")
    print(f"🔍 DEBUG: has_government_license repr = {repr(has_government_license)}")

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

    # 🔍 DEBUG: Log the UserCreate object
    print(f"🔍 DEBUG: user_data.has_government_license = {user_data.has_government_license}")
    print(f"🔍 DEBUG: user_data.has_government_license type = {type(user_data.has_government_license)}")

    result = create_user_by_admin(user_data, changed_by, db)
    
    # 🔍 DEBUG: Log the result if possible
    print(f"🔍 DEBUG: Created user result: {result}")
    
    return result
# @router.post("/vehicle-inspection")
# def vehicle_inspection(data: VehicleInspectionSchema, db: Session = Depends(get_db),payload: dict = Depends(token_check)):
#     try:
#         return vehicle_inspection_logic(data, db)
#     except HTTPException as e:
#         raise e
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))
    

# @router.patch("/{vehicle_id}/status")
# def patch_vehicle_status(
#     vehicle_id: UUID,
#     status_update: VehicleStatusUpdate,
#     db: Session = Depends(get_db),
#     payload: dict = Depends(token_check)
# ):
#     user_id = payload.get("user_id") or payload.get("sub")
#     if not user_id:
#         return {"error": "User ID not found in token"}, 401
    
#     res=update_vehicle_status(vehicle_id, status_update.new_status, status_update.freeze_reason, db, user_id)
#     new_status=res["new_status"]
#     sio.emit('vehicle_status_updated', {
#             "vehicle_id": str(vehicle_id),
#             "status": new_status,
#             "freeze_reason": res.get("freeze_reason", "")
#     })
#     return res

# @router.get("/vehicle/{vehicle_id}")
# def get_vehicle_by_id_route(vehicle_id: str, db: Session = Depends(get_db)):
#     return get_vehicle_by_id(vehicle_id, db)

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

# @router.get("/all-vehicles", response_model=List[VehicleOut])
# def get_all_vehicles_route(status: Optional[str] = Query(None), db: Session = Depends(get_db)
#     ,payload: dict = Depends(token_check)):
#     vehicles = get_vehicles_with_optional_status(db, status)
#     return vehicles




@router.post("/notifications/admin", include_in_schema=True,   dependencies=[] )
def send_admin_notification_simple_route(db: Session = Depends(get_db)):
    vehicle = db.query(Vehicle).first()  # Get any vehicle (you can adjust logic later if needed)
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="No vehicle found.")

    notifications = send_admin_odometer_notification(vehicle.id, vehicle.odometer_reading)

    if not notifications:
        raise HTTPException(status_code=204, detail="No admins found or odometer below threshold.")

    return {
        "detail": "Notifications sent",
        "count": len(notifications),
        "vehicle_id": str(vehicle.id),
        "plate_number": vehicle.plate_number,
        "odometer_reading": vehicle.odometer_reading

    }


# This function will be called later by another function with a GET route.
@router.post("/stats/archive-last-month")
def archive_last_month_endpoint(db: Session = Depends(get_db)):
    archive_last_month_stats(db)
    return {"detail": "Archiving completed successfully"}


@router.get("/analytics/vehicle-status-summary")
def vehicle_status_summary(db: Session = Depends(get_db)):
    try:
        result = (
            db.query(Vehicle.status, func.count(Vehicle.id).label("count"))
            .group_by(Vehicle.status)
            .all()
        )
        # Format response as a list of dicts
        summary = [{"status": row.status.value, "count": row.count} for row in result]
        return JSONResponse(content=summary)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching summary: {str(e)}")

@router.get("/analytics/ride-status-summary")
def ride_status_summary(db: Session = Depends(get_db)):
    try:
        result = (
            db.query(Ride.status, func.count(Ride.id).label("count"))
            .group_by(Ride.status)
            .all()
        )
        summary = [{"status": row.status.value, "count": row.count} for row in result]
        return JSONResponse(content=summary)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching ride summary: {str(e)}")


# @router.get("/analytics/weekly-ride-trends")
# def weekly_ride_trends(db: Session = Depends(get_db)):
#     try:
#         today = datetime.utcnow().date()
#         week_ago = today - timedelta(days=6)  # last 7 days including today

#         # Group by date, count rides
#         results = (
#             db.query(
#                 cast(Ride.start_datetime, Date).label("ride_date"),
#                 func.count(Ride.id).label("count")
#             )
#             .filter(Ride.start_datetime >= week_ago)
#             .group_by("ride_date")
#             .order_by("ride_date")
#             .all()
#         )

#         # Convert to list of dicts
#         response = [{"date": str(r.ride_date), "count": r.count} for r in results]

#         return JSONResponse(content=response)
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to fetch weekly ride trends: {str(e)}")


# @router.post("/update-monthly-trip-counts")
# def monthly_trip_count_update(db: Session = Depends(get_db)):
#     try:
#         update_monthly_trip_counts(db)
#         return {"message": "Monthly trip counts updated successfully"}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))


@router.get("/all-audit-logs", response_model=List[AuditLogsSchema])
def get_all_audit_logs_route(
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    problematic_only: bool = Query(False),  
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





@router.get("/inspections/today", response_model=List[VehicleInspectionSchema])
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
    return inspections


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