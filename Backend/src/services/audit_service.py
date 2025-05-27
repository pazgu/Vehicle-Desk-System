from ..models.audit_log_model import AuditLog
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional
from ..schemas.audit_schema import AuditLogsSchema

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
        # Try to extract full name from change_data, fallback to changed_by or empty string
        first = change_data.get("first_name") or ""
        last = change_data.get("last_name") or ""
        full_name = (first + " " + last).strip()
        if not full_name:
            # fallback: try full_name key, or just show empty string or "Unknown"
            full_name = change_data.get("full_name") or ""
            if not full_name:
                full_name = "Unknown"
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
    return result