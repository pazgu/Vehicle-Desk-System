from fastapi import APIRouter, Depends, HTTPException, Query,Header, Request, status, UploadFile, File, Form , Path , Body
from uuid import UUID
from fastapi.staticfiles import StaticFiles
from typing import Optional , List
from datetime import datetime, time
from sqlalchemy.orm import Session
from ..models.no_show_events import NoShowEvent
from src.schemas.vehicle_inspection_schema import VehicleInspectionOut
from src.schemas.user_response_schema import UserResponse
from src.schemas.ride_dashboard_item import RideDashboardItem
from src.schemas.trip_completion_schema import RawCriticalIssueSchema, TripCompletionIssueSchema
from src.services.user_data import get_user_by_id, get_all_users
from src.services.admin_rides_service import (
    get_all_orders,
    get_future_orders,
    get_past_orders,
    get_orders_by_user,
    get_order_by_ride_id,
    get_all_time_vehicle_usage_stats 
)
from typing import Optional
from datetime import datetime
from sqlalchemy import and_, or_ ,desc
from ..utils.database import get_db
from src.models.user_model import User , UserRole
from src.models.vehicle_model import Vehicle
from ..schemas.check_vehicle_schema import VehicleInspectionSchema
from ..schemas.vehicle_schema import VehicleOut , InUseVehicleOut , VehicleStatusUpdate , MileageUpdateRequest
from ..utils.auth import get_current_user, token_check
from ..services.vehicle_service import archive_vehicle_by_id, get_available_vehicles_for_ride_by_id,delete_vehicle_by_id
from ..services.user_notification import send_admin_odometer_notification
from datetime import date, datetime, timedelta
from src.models.vehicle_inspection_model import VehicleInspection
from ..services.monthly_trip_counts import archive_last_month_stats
from sqlalchemy import func, text
from fastapi.responses import JSONResponse
from src.models.ride_model import Ride
from src.utils.stats import generate_monthly_vehicle_usage
from ..schemas.register_schema import UserCreate
from src.services import admin_service
from ..schemas.audit_schema import AuditLogsSchema
from src.services.audit_service import get_all_audit_logs
from ..utils.socket_manager import sio
from ..services.admin_rides_service import get_critical_trip_issues, get_current_month_vehicle_usage ,  get_vehicle_usage_stats
from fastapi.security import OAuth2PasswordBearer
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
from ..utils.auth import role_check
from fastapi import HTTPException
from ..services.admin_user_service import create_user_by_admin , get_users_service
from ..schemas.user_response_schema import PaginatedUserResponse
from src.utils.auth import get_current_user
from ..services.license_service import upload_license_file_service , check_expired_licenses
from ..services.license_service import upload_license_file_service 
from src.services.admin_rides_service import get_critical_issue_by_id 
from src.schemas.order_card_item import OrderCardItem
from src.schemas.statistics_schema import NoShowStatsResponse,TopNoShowUser
from src.models.department_model import Department
from src.schemas.department_schema import DepartmentCreate, DepartmentUpdate, DepartmentOut
from src.services import department_service

import pandas as pd


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



# @router.patch("/user-data-edit/{user_id}", response_model=UserResponse)
# async def edit_user_by_id_route(
#     user_id: UUID,
#     first_name: str = Form(...),
#     last_name: str = Form(...),
#     username: str = Form(...),
#     email: str = Form(...),
#     phone: str = Form(...),
#     role: str = Form(...),
#     department_id: str = Form(...),
#     has_government_license: str = Form(...),
#     license_file: UploadFile = File(None),
#     db: Session = Depends(get_db),
#     payload: dict = Depends(token_check), # payload contains user_id and role from JWT
#     license_expiry_date: Optional[str] = Form(None)
# ):
    
#     print(f"\n--- Debugging edit_user_by_id_route ---")
#     print(f"User ID from URL path: {user_id} (Type: {type(user_id)})")
#     print(f"Payload from token_check: {payload}")
    
#     user_id_from_token = payload.get("user_id") or payload.get("sub")
#     user_role_from_token = payload.get("role")

#     print(f"User ID from token: {user_id_from_token} (Type: {type(user_id_from_token)})")
#     print(f"User Role from token: {user_role_from_token} (Type: {type(user_role_from_token)})")
#     print(f"Comparison: str(user_id) == user_id_from_token -> {str(user_id) == user_id_from_token}")
#     print(f"Comparison: user_role_from_token == 'admin' -> {user_role_from_token == 'admin'}")
#     # --- DEBUGGING LOGS END ---

#     user = db.query(User).filter(User.employee_id == user_id).first()
#     if not user:
#         raise HTTPException(status_code=404, detail="User not found")

#     if not user_id_from_token:
#         raise HTTPException(status_code=401, detail="User ID not found in token")

#     if str(user_id) != user_id_from_token and user_role_from_token != "admin": # Adjust "admin" role name if different
#         print(f"DEBUG: Authorization FAILED. User {user_id_from_token} (Role: {user_role_from_token}) tried to edit {user_id}.")
#         raise HTTPException(status_code=403, detail="Not authorized to edit this user's data.")

#     db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user_id_from_token)})
#     has_gov_license = has_government_license.lower() == "true"

#     if user.license_file_url is not None and has_gov_license != user.has_government_license:
#         print(f"DEBUG: License flag change FAILED (file exists). Current: {user.has_government_license}, New: {has_gov_license}")
#         raise HTTPException(
#             status_code=403,
#             detail="'Has government license' flag cannot be changed after initial upload."
#         )

#     if user.license_file_url is not None and license_file:
#         print(f"DEBUG: License file re-upload FAILED. Existing URL: {user.license_file_url}, New file: {license_file.filename}")
#         raise HTTPException(
#             status_code=403,
#             detail="Government license file cannot be re-uploaded after initial upload."
#         )
#     # If no file exists in the database and a new file is provided, save it.
#     if user.license_file_url is None and license_file:
#         try:
#             contents = await license_file.read()
#             # Ensure 'uploads' directory exists and is writable
#             filename = f"uploads/{license_file.filename}"
#             with open(filename, "wb") as f:
#                 f.write(contents)
#             user.license_file_url = f"/{filename}"
#             # If a file is uploaded, set has_government_license to True if it's not already set
#             if user.has_government_license is None:
#                 user.has_government_license = True
#         except Exception as e:
#             raise HTTPException(status_code=500, detail=f"Failed to save license file: {e}")

#     # If an expiry date already exists in the database AND the new date is different, forbid it.
#     if user.license_expiry_date is not None and license_expiry_date:
#         try:
#             new_date = datetime.strptime(license_expiry_date, "%Y-%m-%d").date()
#             if new_date != user.license_expiry_date:
#                 print(f"DEBUG: License expiry date change FAILED. Current: {user.license_expiry_date}, New: {new_date}")
#                 raise HTTPException(
#                     status_code=403,
#                     detail="License expiry date cannot be edited after initial upload."
#                 )
#         except ValueError:
#             raise HTTPException(status_code=400, detail="Invalid date format for license_expiry_date. Expected YYYY-MM-DD.")
#     # If no expiry date exists and a new date is provided, save it.
#     if user.license_expiry_date is None and license_expiry_date:
#         try:
#             user.license_expiry_date = datetime.strptime(license_expiry_date, "%Y-%m-%d").date()
#             # If expiry date is set, ensure has_government_license is True if not already set
#             if user.has_government_license is None:
#                 user.has_government_license = True
#         except ValueError:
#             raise HTTPException(status_code=400, detail="Invalid date format for license_expiry_date. Expected YYYY-MM-DD.")
    
#     # Apply updates to the other, non-restricted fields.
#     user.first_name = first_name
#     user.last_name = last_name
#     user.username = username
#     user.email = email
#     user.phone = phone
#     user.role = role
#     user.department_id = department_id
    
#     # Only set has_government_license from form if it hasn't been set by file/date upload logic above
#     # and it's currently None in the DB. This handles the initial setting via the checkbox.
#     if user.has_government_license is None:
#         user.has_government_license = has_gov_license 
    
#     try:
#         db.commit()
#     except Exception as e:
#         db.rollback()
#         print("❌ Commit failed:", e) # Log the actual exception for debugging
#         raise HTTPException(status_code=500, detail="Failed to update user due to a database error.")

#     db.refresh(user)

#     # Emit Socket.IO event on successful license update
#     await sio.emit('user_license_updated', {
#         "id": str(user.employee_id),
#         "license_expiry_date": user.license_expiry_date.isoformat() if user.license_expiry_date else None,
#         "has_government_license": bool(user.has_government_license),
#         "license_file_url": user.license_file_url or ""
#     })

#     # Reset session audit user ID
#     db.execute(text("SET session.audit.user_id = DEFAULT"))
#     return user

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from uuid import UUID
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text # Make sure text is imported
from src.schemas.user_response_schema import UserResponse # Assuming this path is correct
from src.models.user_model import User, UserRole # Import User and UserRole enum
from src.utils.database import get_db # Assuming this path is correct
from src.utils.auth import token_check # Assuming this path is correct
from src.utils.socket_manager import sio # Assuming this path is correct (if you have one)
import uuid # For UUID casting if needed


@router.patch("/user-data-edit/{user_id}", response_model=UserResponse)
async def edit_user_by_id_route(
    user_id: UUID,
    first_name: str = Form(...),
    last_name: str = Form(...),
    username: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    role: str = Form(...), # This will be the string from the form
    department_id: str = Form(...), # This will be the string from the form
    has_government_license: str = Form(...),
    license_file: UploadFile = File(None),
    db: Session = Depends(get_db),
    payload: dict = Depends(token_check), # payload contains user_id and role from JWT
    license_expiry_date: Optional[str] = Form(None)
):
    print(f"\n--- Debugging edit_user_by_id_route ---")
    print(f"User ID from URL path: {user_id} (Type: {type(user_id)})")
    print(f"Payload from token_check: {payload}")

    user_id_from_token = payload.get("user_id") or payload.get("sub")
    user_role_from_token = payload.get("role")

    print(f"User ID from token: {user_id_from_token} (Type: {type(user_id_from_token)})")
    print(f"User Role from token: {user_role_from_token} (Type: {type(user_role_from_token)})")
    print(f"Comparison: str(user_id) == user_id_from_token -> {str(user_id) == user_id_from_token}")
    print(f"Comparison: user_role_from_token == 'admin' -> {user_role_from_token == 'admin'}")
    # --- DEBUGGING LOGS END ---

    user = db.query(User).filter(User.employee_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user_id_from_token:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    # Authorization: User can edit their own data OR if they are an admin
    if str(user_id) != user_id_from_token and user_role_from_token != UserRole.admin.value:
        print(f"DEBUG: Authorization FAILED. User {user_id_from_token} (Role: {user_role_from_token}) tried to edit {user_id}.")
        raise HTTPException(status_code=403, detail="Not authorized to edit this user's data.")

    # Set session audit user ID for database triggers/logging
    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user_id_from_token)})

    has_gov_license = has_government_license.lower() == "true"

    # --- License File and Expiry Date Logic (from your old code, unchanged for this issue) ---
    if user.license_file_url is not None and has_gov_license != user.has_government_license:
        print(f"DEBUG: License flag change FAILED (file exists). Current: {user.has_government_license}, New: {has_gov_license}")
        raise HTTPException(
            status_code=403,
            detail="'Has government license' flag cannot be changed after initial upload."
        )

    if user.license_file_url is not None and license_file:
        print(f"DEBUG: License file re-upload FAILED. Existing URL: {user.license_file_url}, New file: {license_file.filename}")
        raise HTTPException(
            status_code=403,
            detail="Government license file cannot be re-uploaded after initial upload."
        )

    if user.license_file_url is None and license_file:
        try:
            contents = await license_file.read()
            filename = f"uploads/{license_file.filename}"
            with open(filename, "wb") as f:
                f.write(contents)
            user.license_file_url = f"/{filename}"
            if user.has_government_license is None: # This might still be True/False from DB, not None. Consider `if not user.has_government_license:`
                user.has_government_license = True
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save license file: {e}")

    if user.license_expiry_date is not None and license_expiry_date:
        try:
            new_date = datetime.strptime(license_expiry_date, "%Y-%m-%d").date()
            if new_date != user.license_expiry_date:
                print(f"DEBUG: License expiry date change FAILED. Current: {user.license_expiry_date}, New: {new_date}")
                raise HTTPException(
                    status_code=403,
                    detail="License expiry date cannot be edited after initial upload."
                )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format for license_expiry_date. Expected YYYY-MM-DD.")

    if user.license_expiry_date is None and license_expiry_date:
        try:
            user.license_expiry_date = datetime.strptime(license_expiry_date, "%Y-%m-%d").date()
            if user.has_government_license is None: # Same note as above.
                user.has_government_license = True
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format for license_expiry_date. Expected YYYY-MM-DD.")
    # --- End License File and Expiry Date Logic ---

    # Apply updates to the other, non-restricted fields.
    user.first_name = first_name
    user.last_name = last_name
    user.username = username
    user.email = email
    user.phone = phone

    # --- New Department ID Logic ---
    try:
        new_role = UserRole(role) # Convert incoming string 'role' to UserRole enum
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role provided: {role}. Must be one of: {', '.join([r.value for r in UserRole])}")

    user.role = new_role # Assign the validated role

    if new_role == UserRole.admin:
        # If the new role is 'admin', department_id MUST be NULL according to your check constraint
        if department_id and department_id.strip(): # Check if department_id was provided in the form
            print(f"DEBUG: department_id '{department_id}' provided for admin role. Setting to None.")
            # Optionally, you might raise an HTTP 400 if you want to explicitly forbid sending department_id for admins
            # raise HTTPException(status_code=400, detail="Admin users cannot have a department ID.")
        user.department_id = None # Set to None to satisfy the constraint and model's nullable=True
    else:
        # If the role is NOT admin, department_id MUST NOT be NULL
        if not department_id or not department_id.strip(): # Check for empty string or whitespace
            raise HTTPException(status_code=400, detail=f"Department ID is required for role '{new_role}'.")
        try:
            user.department_id = UUID(department_id) # Convert string to UUID
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid department ID format. Must be a valid UUID.")
    # --- End New Department ID Logic ---

    # Only set has_government_license from form if it hasn't been explicitly set by file/date upload logic
    # and it's currently False/None in DB (assuming your default is False).
    # Re-evaluating this part for clarity:
    # If the file/date logic *didn't* set it (i.e., no file uploaded, no date provided)
    # AND the existing user's has_government_license isn't already True due to a prior upload,
    # then apply the value from the form.
    # A simpler approach if the form value is always considered the most up-to-date:
    user.has_government_license = has_gov_license

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print("❌ Commit failed:", e)
        # Log the actual exception type for better debugging if it's not a CheckViolation/NotNullViolation
        print(f"DEBUG: Exception type: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Failed to update user due to a database error.")

    db.refresh(user)

    # Emit Socket.IO event on successful license update
    # Ensure sio is imported and initialized correctly elsewhere if this causes errors
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
        print("❌ Error fetching critical issue details:", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to fetch issue details: {str(e)}")


from typing import Dict, Any
@router.get("/critical-issues", response_model=Dict[str, List[Any]])
def get_critical_issues(
    problem_type: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    # Initialize the query for VehicleInspections
    inspections_query = db.query(VehicleInspection)

    # Initialize rides_data by fetching ALL rides with emergency_event == "true" by default.
    rides = db.query(Ride).filter(Ride.emergency_event == "true").all()
    rides_data = [OrderCardItem.from_orm(r) for r in rides]

    if problem_type == "medium":
        inspections_query = inspections_query.filter(
            VehicleInspection.fuel_checked == False
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

    else: # problem_type is None
        inspections_query = inspections_query.filter(
            or_(
                VehicleInspection.fuel_checked == False,
                and_(
                    VehicleInspection.critical_issue_bool == True,
                    and_(
                        VehicleInspection.issues_found != None,
                        VehicleInspection.issues_found != ""
                    )
                )
            )
        )

    # Execute the VehicleInspection query
    inspections = inspections_query.order_by(VehicleInspection.inspection_date.desc()).all()
    
    # Use VehicleInspectionOut with from_orm
    inspections_data = [VehicleInspectionOut.from_orm(i) for i in inspections]

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
    print("🧪 NO-SHOW STATS ENDPOINT DEBUG:")
    print("FROM DATE:", from_date)
    print("TO DATE:", to_date)
    print("TYPE FROM:", type(from_date))
    print("TYPE TO:", type(to_date))

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
def create_department(dept: DepartmentCreate, db: Session = Depends(get_db)):
    return department_service.create_department(db, dept)

@router.patch("/departments/{department_id}", response_model=DepartmentOut)
def patch_department(department_id: UUID, dept: DepartmentUpdate, db: Session = Depends(get_db)):
    return department_service.update_department(db, department_id, dept)
