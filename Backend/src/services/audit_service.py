from ..models.audit_log_model import AuditLog
from ..models.user_model import User  # Import the User model
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from ..schemas.audit_schema import AuditLogsSchema
import json

def get_all_audit_logs(
    db: Session,
    from_date: datetime = None,
    to_date: datetime = None,
    problematic_only: bool = False
) -> list[AuditLogsSchema]:
    query = db.query(AuditLog)
    if not from_date:
        from_date = datetime.utcnow() - timedelta(days=180)
    query = query.filter(AuditLog.created_at >= from_date)
    if to_date:
        query = query.filter(AuditLog.created_at <= to_date)

    if problematic_only:
        query = query.filter(AuditLog.checkbox_value == True)  # Only logs with issues

    logs = query.all()

    result = []
    for log in logs:
        change_data = log.change_data or {}
        
        # Extract first and last name from change_data
        first = change_data.get("first_name") or ""
        last = change_data.get("last_name") or ""
        
        # Check nested 'new' or 'old' keys if first_name/last_name are not found
        if not first and not last:
            nested_data = change_data.get("new") or change_data.get("old") or {}
            first = nested_data.get("first_name") or ""
            last = nested_data.get("last_name") or ""
        
        # If still no name, fetch from the users table using changed_by
        if not first and not last and log.changed_by:
            user = db.query(User).filter(User.employee_id == log.changed_by).first()
            if user:
                first = user.first_name or ""
                last = user.last_name or ""
        
        # Handle Ride entity type for INSERT and UPDATE actions
        if not first and not last and log.entity_type == "Ride":
            user_id = None
            if log.action == "INSERT":
                user_id = change_data.get("user_id")
            elif log.action == "UPDATE":
                user_id = change_data.get("new", {}).get("user_id") or change_data.get("old", {}).get("user_id")
            
            if user_id:
                user = db.query(User).filter(User.employee_id == user_id).first()
                if user:
                    first = user.first_name or ""
                    last = user.last_name or ""
        
        # Construct full_name or fallback to "Unknown"
        full_name = (first + " " + last).strip() or "Unknown"
        
        result.append(AuditLogsSchema(
            id=log.id,
            full_name=full_name,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            change_data=log.change_data,
            created_at=log.created_at,
            changed_by=log.changed_by,
            checkbox_value=log.checkbox_value,
            inspected_at=log.inspected_at,
            # inspector_id=log.inspector_id,
            notes=log.notes
        ))
        
    return result