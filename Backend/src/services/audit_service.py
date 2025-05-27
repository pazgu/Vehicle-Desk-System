from ..models.audit_log_model import AuditLog
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional
from ..schemas.audit_schema import AuditLogsSchema

def get_all_audit_logs(db: Session, from_date: datetime = None, to_date: datetime = None) -> list[AuditLogsSchema]:
    query = db.query(AuditLog)

    # Only show logs from the last 6 months by default
    if not from_date:
        from_date = datetime.utcnow() - timedelta(days=180)
    query = query.filter(AuditLog.created_at >= from_date)

    if to_date:
        query = query.filter(AuditLog.created_at <= to_date)

    logs = query.all()
    result = []
    for log in logs:
        change_data = log.change_data or {}
        first = change_data.get("first_name", "")
        last = change_data.get("last_name", "")
        full_name = f"{first} {last}".strip()
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