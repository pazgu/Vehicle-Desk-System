from ..models.audit_log_model import AuditLog
from ..models.user_model import User  # Import the User model
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from ..schemas.audit_schema import AuditLogsSchema
import json

def get_all_audit_logs(db: Session, from_date: datetime = None, to_date: datetime = None) -> list[AuditLogsSchema]:
    query = db.query(AuditLog)
    if not from_date:
        from_date = datetime.utcnow() - timedelta(days=180)
    query = query.filter(AuditLog.created_at >= from_date)
    if to_date:
        query = query.filter(AuditLog.created_at <= to_date)
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
        if not first and not last:
            user = db.query(User).filter(User.employee_id == log.changed_by).first()
            if user:
                first = user.first_name or ""
                last = user.last_name or ""
        
        # If entity_type is not User, attempt to fetch name from other fields
        if not first and not last and log.entity_type != "User":
            user_id = change_data.get("user_id")
            if user_id:
                user = db.query(User).filter(User.employee_id == user_id).first()
                if user:
                    first = user.first_name or ""
                    last = user.last_name or ""
        
        # Construct full_name or fallback to "Unknown"
        full_name = (first + " " + last).strip() or change_data.get("full_name") or "Unknown"
        
        result.append(AuditLogsSchema(
            id=log.id,
            full_name=full_name,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            change_data=log.change_data,
            created_at=log.created_at,
            changed_by=log.changed_by
        ))
    print(f"!!!!!!!!!!!!!!!!!!!!!!!\n{json.dumps(change_data, indent=4)}\n")
    return result