from ..models.audit_log_model import AuditLog
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional

def get_all_audit_logs(db: Session, from_date: datetime = None, to_date: datetime = None) -> List[AuditLog]:
    query = db.query(AuditLog)

    # Only show logs from the last 6 months by default
    if not from_date:
        from_date = datetime.utcnow() - timedelta(days=180)
    query = query.filter(AuditLog.created_at >= from_date)  # <-- changed from timestamp to created_at

    if to_date:
        query = query.filter(AuditLog.created_at <= to_date)  # <-- changed from timestamp to created_at

    return query.all()