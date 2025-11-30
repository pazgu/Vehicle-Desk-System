import calendar
from datetime import datetime, date, time
from typing import List, Optional, Dict, Any
from uuid import UUID

from sqlalchemy import String, extract, func, and_, or_
from sqlalchemy.orm import Session

# Schemas
from ..schemas.ride_dashboard_item import RideDashboardItem

# Models
from ..models.monthly_vehicle_usage_model import MonthlyVehicleUsage
from ..models.ride_model import Ride, RideStatus
from ..models.user_model import User
from ..models.vehicle_inspection_model import VehicleInspection
from ..models.vehicle_model import Vehicle
from src.models.ride_approval_model import RideApproval

from src.schemas.statistics_schema import (
    NoShowStatsResponse,
    TopNoShowUser,
    RideStartTimeStatsResponse,
    RideStartTimeBucket,
    PurposeOfTravelStatsResponse,
    MonthlyPurposeBreakdown,
)




def filter_rides(query, status: Optional[RideStatus], from_date, to_date):
    if status:
        query = query.filter(Ride.status == status)
    if from_date:
        query = query.filter(Ride.start_datetime >= from_date)
    if to_date:
        query = query.filter(Ride.start_datetime <= to_date)
    return query.order_by(Ride.start_datetime)

def build_dashboard_item(
    ride_id, user_first_name, user_last_name, vehicle_id,
    start_datetime, estimated_distance_km, status, submitted_at
):
    return RideDashboardItem(
        ride_id=ride_id,
        employee_name=f"{user_first_name} {user_last_name}",
        requested_vehicle_model = f"Plate-{str(vehicle_id)[:8]}",
        vehicle_id=vehicle_id,
        date_and_time=start_datetime,
        distance=str(estimated_distance_km),
        status=status,
        submitted_at=submitted_at
    )

def get_all_orders(db: Session, status=None, from_date=None, to_date=None) -> List[RideDashboardItem]:
    query = db.query(
        Ride.id.label("ride_id"),
        Ride.start_datetime,
        Ride.estimated_distance_km,
        Ride.status,
        Ride.submitted_at,
        Vehicle.id.label("vehicle_id"),
        User.first_name,
        User.last_name

    ).join(Vehicle, Ride.vehicle_id == Vehicle.id) \
     .join(User, Ride.user_id == User.employee_id)  

    query = filter_rides(query, status, from_date, to_date)

    return [
        build_dashboard_item(
            ride_id=r.ride_id,
            user_first_name=r.first_name,
            user_last_name=r.last_name,
            vehicle_id=r.vehicle_id,
            start_datetime=r.start_datetime,
            estimated_distance_km=r.estimated_distance_km,
            status=r.status,
            submitted_at=r.submitted_at 
        )
        for r in query.all()
    ]

def get_future_orders(db: Session, status=None, from_date=None, to_date=None) -> List[RideDashboardItem]:
    filter_from_date = from_date or datetime.utcnow()
    return get_all_orders(db, status=status, from_date=filter_from_date, to_date=to_date)

def get_past_orders(db: Session, status=None, from_date=None, to_date=None) -> List[RideDashboardItem]:
    filter_to_date = to_date or datetime.utcnow()
    return get_all_orders(db, status=status, from_date=from_date, to_date=filter_to_date)

def get_orders_by_user(db: Session, user_id: UUID) -> List[RideDashboardItem]:
    query = db.query(
        Ride.id.label("ride_id"),
        Ride.start_datetime,
        Ride.estimated_distance_km,
        Ride.status,
        Vehicle.id.label("vehicle_id"),
        User.first_name,
        User.last_name
    ).join(Vehicle, Ride.vehicle_id == Vehicle.id) \
     .join(User, Ride.user_id == User.employee_id) \
     .filter(User.employee_id == user_id)

    return [
        build_dashboard_item(
            ride_id=r.ride_id,
            user_first_name=r.first_name,
            user_last_name=r.last_name,
            vehicle_id=r.vehicle_id,
            start_datetime=r.start_datetime,
            estimated_distance_km=r.estimated_distance_km,
            status=r.status
        )
        for r in query.all()
    ]

def get_order_by_ride_id(db: Session, ride_id: UUID) -> Optional[RideDashboardItem]:
    r = db.query(
        Ride.id.label("ride_id"),
        Ride.start_datetime,
        Ride.estimated_distance_km,
        Ride.status,
        Vehicle.id.label("vehicle_id"),
        User.first_name,
        User.last_name
    ).join(Vehicle, Ride.vehicle_id == Vehicle.id) \
     .join(User, Ride.user_id == User.employee_id) \
     .filter(Ride.id == ride_id) \
     .first()

    if not r:
        return None

    return build_dashboard_item(
        ride_id=r.ride_id,
        user_first_name=r.first_name,
        user_last_name=r.last_name,
        vehicle_id=r.vehicle_id,
        start_datetime=r.start_datetime,
        estimated_distance_km=r.estimated_distance_km,
        status=r.status
    )


def update_monthly_usage_stats(db: Session, ride: Ride):

    if not ride.end_datetime:
        ride.end_datetime = datetime.utcnow()

    year = ride.start_datetime.year
    month = ride.start_datetime.month
    duration_hours = (ride.end_datetime - ride.start_datetime).total_seconds() / 3600.0
    distance = float(ride.actual_distance_km or 0)

    stats = db.query(MonthlyVehicleUsage).filter_by(
        vehicle_id=ride.vehicle_id,
        year=year,
        month=month
    ).first()

    if stats:
        stats.total_rides += 1
        stats.total_km += distance
        stats.usage_hours += duration_hours
    else:
        stats = MonthlyVehicleUsage(
            vehicle_id=ride.vehicle_id,
            year=year,
            month=month,
            total_rides=1,
            total_km=distance,
            usage_hours=duration_hours
        )
        db.add(stats)


def get_current_month_vehicle_usage(db: Session) -> List[Dict]:
    now = datetime.utcnow()
    current_year = now.year
    current_month = now.month

    usage_entries = (
        db.query(
            MonthlyVehicleUsage.vehicle_id,
            MonthlyVehicleUsage.total_rides,
            MonthlyVehicleUsage.total_km,
            MonthlyVehicleUsage.usage_hours,
            Vehicle.plate_number,
            Vehicle.vehicle_model
        )
        .join(Vehicle, Vehicle.id == MonthlyVehicleUsage.vehicle_id)
        .filter(
            MonthlyVehicleUsage.year == current_year,
            MonthlyVehicleUsage.month == current_month
        )
        .all()
    )

    return [
        {
            "vehicle_id": str(entry.vehicle_id),
            "plate_number": entry.plate_number,
            "vehicle_model": entry.vehicle_model,
            "total_rides": entry.total_rides,
            "total_km": float(entry.total_km),
            "percentage_in_use_time": round((entry.usage_hours / (24 * 30)) * 100, 1)  # ← based on 30-day month
        }
        for entry in usage_entries
    ]


def get_vehicle_usage_stats(db: Session, year: int, month: int) -> List[dict]:
    usage_data = (
        db.query(
            MonthlyVehicleUsage.vehicle_id,
            MonthlyVehicleUsage.total_rides,
            MonthlyVehicleUsage.total_km,
            MonthlyVehicleUsage.usage_hours,
            Vehicle.plate_number,
            Vehicle.vehicle_model
        )
        .join(Vehicle, Vehicle.id == MonthlyVehicleUsage.vehicle_id)
        .filter(
            MonthlyVehicleUsage.year == year,
            MonthlyVehicleUsage.month == month
        )
        .all()
    )

    return [
        {
            "vehicle_id": str(row.vehicle_id),
            "plate_number": row.plate_number,
            "vehicle_model": row.vehicle_model,
            "total_rides": row.total_rides,
            "total_km": float(row.total_km),
            "percentage_in_use_time": round((row.usage_hours / (24 * 30)) * 100, 1)  # assumes 30 days
        }
        for row in usage_data
    ]

def get_all_time_vehicle_usage_stats(db: Session) -> List[dict]:
    usage_data = (
        db.query(
            MonthlyVehicleUsage.vehicle_id,
            func.sum(MonthlyVehicleUsage.total_rides).label("total_rides"),
            func.sum(MonthlyVehicleUsage.total_km).label("total_km"),
            func.sum(MonthlyVehicleUsage.usage_hours).label("usage_hours"),
            Vehicle.plate_number,
            Vehicle.vehicle_model
        )
        .join(Vehicle, Vehicle.id == MonthlyVehicleUsage.vehicle_id)
        .group_by(MonthlyVehicleUsage.vehicle_id, Vehicle.plate_number, Vehicle.vehicle_model)
        .all()
    )

    return [
        {
            "vehicle_id": str(row.vehicle_id),
            "plate_number": row.plate_number,
            "vehicle_model": row.vehicle_model,
            "total_rides": row.total_rides,
            "total_km": float(row.total_km),
            "percentage_in_use_time": round((row.usage_hours / (24 * 30 * 12)) * 100, 1)  # ← simple average
        }
        for row in usage_data
    ]

def get_critical_trip_issues(db: Session) -> List[dict]:
    results = (
        db.query(RideApproval)
        .filter(RideApproval.status == "rejected")
        .all()
    )

    issues = []
    for item in results:
        issues.append({
            "ride_id": item.ride_id,
            "approved_by": item.approved_by,
            "role": item.role,
            "status": item.status,
            "timestamp": item.timestamp,
            "severity": "critical",  # we mark all rejections as critical
            "issue_description": f"Trip was rejected by {item.role}"  # optional short desc
        })

    return issues


def get_all_critical_issues_combined(db: Session) -> List[Dict[str, Any]]:
    results = []

    # 🚨 From inspector table (VehicleInspection)
    inspector_issues = db.query(VehicleInspection).filter(
        VehicleInspection.critical_issue_bool == True
    ).all()

    for issue in inspector_issues:
        results.append({
            "inspection_id": str(issue.inspection_id),
            "ride_id": None, #not used in front!!
            "approved_by": str(issue.inspected_by),
            "role": "inspector",
            "status": "critical",
            "severity": "critical",
            "issue_description": issue.issues_found or "בעיה חמורה זוהתה במהלך בדיקה",
            "timestamp": issue.inspection_date,
            "vehicle_info": f"Vehicle ID: {issue.vehicle_id}" if hasattr(issue, 'vehicle_id') else ""
        })

    # 🚨 From ride approvals table (Trip Completion)
    trip_issues = db.query(RideApproval).filter(
        RideApproval.status == "rejected"
    ).all()

    for issue in trip_issues:
        results.append({
            "inspection_id": None,
            "ride_id": str(issue.ride_id),
            "approved_by": str(issue.approved_by),
            "role": issue.role,
            "status": issue.status,
            "severity": "critical",  # Mark all rejections as critical
            "issue_description": f"נסיעה נדחתה על ידי {issue.role}",
            "timestamp": issue.timestamp,
            "vehicle_info": f"Ride ID: "
        })


    # ⏱️ Sort by most recent
    return sorted(results, key=lambda x: x["timestamp"], reverse=True)

def get_critical_issue_by_id(issue_id: str, db: Session) -> Optional[Dict[str, Any]]:
    """
    Get a specific critical issue by ID — supports both inspection_id and composite ride_id+timestamp.
    """
    try:
        # If it's a valid UUID → must be from inspector form
        uuid_id = UUID(issue_id)
        # Try VehicleInspection (inspector issue)
        inspection = db.query(VehicleInspection).filter(
            VehicleInspection.inspection_id == uuid_id,
            VehicleInspection.critical_issue_bool == True
        ).first()

        if inspection:
           return {
            "id": str(inspection.inspection_id),
            "inspection_id": inspection.inspection_id,
            "ride_id": None,
            "approved_by": inspection.inspected_by,
            "submitted_by": inspection.inspected_by,
            "role": "inspector",
            "type": "inspector",
            "status": "critical",
            "severity": "critical",
            "issue_description": inspection.issues_found or "בעיה חמורה זוהתה במהלך בדיקה",
            "issue_text": inspection.issues_found or "בעיה חמורה זוהתה במהלך בדיקה",
            "timestamp": inspection.inspection_date,
            "vehicle_info": f"רכב מספר ",
            "inspection_details": {
                "clean": inspection.clean,
                "fuel_checked": inspection.fuel_checked,
                "no_items_left": inspection.no_items_left,
                "issues_found": inspection.issues_found,
            }
        }

    except ValueError:
        pass  # Not a UUID → fall back to RideApproval

    # Try RideApproval (trip rejection issue with composite ID)
    try:
        ride_id_part, timestamp_part = issue_id.split("-20", 1)
        ride_id = UUID(ride_id_part)
        timestamp = "20" + timestamp_part  # Rebuild ISO timestamp

        approval = db.query(RideApproval).filter(
            RideApproval.ride_id == ride_id,
            RideApproval.timestamp == timestamp,
            RideApproval.status == "rejected"
        ).first()

        if approval:
            return {
            "id": issue_id,
            "inspection_id": None,
            "ride_id": approval.ride_id,
            "approved_by": approval.approved_by,
            "submitted_by": approval.approved_by,
            "role": approval.role,
            "type": "trip_completion",
            "status": approval.status,
            "severity": approval.severity,
            "issue_description": approval.issue_description,
            "issue_text": f"נסיעה נדחתה על ידי {approval.role}",
            "timestamp": approval.timestamp,
            "vehicle_info": None,
            "inspection_details": None
        }

    except Exception as e:
        raise(f"Error parsing ride approval ID: {e}")

    return None
def get_ride_start_time_stats_by_hour(
    db: Session,
    from_date: Optional[date],
    to_date: Optional[date],
) -> RideStartTimeStatsResponse:
    """
    Returns ride start-time distribution for the given date range.
    """
    if to_date is None:
        to_d = date.today()
    else:
        to_d = to_date if isinstance(to_date, date) else to_date.date()

    if from_date is None:
        d = to_d.replace(day=1)
        month = d.month - 3
        year = d.year
        while month <= 0:
            month += 12
            year -= 1
        from_d = date(year, month, 1)
    else:
        from_d = from_date if isinstance(from_date, date) else from_date.date()

    start_dt = datetime.combine(from_d, datetime.min.time())
    end_dt = datetime.combine(to_d, datetime.max.time())

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

    buckets: List[RideStartTimeBucket] = [
        RideStartTimeBucket(hour=int(row.hour), ride_count=int(row.ride_count))
        for row in grouped
    ]

    total_rides = sum(b.ride_count for b in buckets)

    return RideStartTimeStatsResponse(
        from_date=from_d,
        to_date=to_d,
        total_rides=total_rides,
        buckets=buckets,
    )
    
def _add_months(year: int, month: int, delta: int) -> tuple[int, int]:
    month += delta
    while month > 12:
        month -= 12
        year += 1
    while month <= 0:
        month += 12
        year -= 1
    return year, month
