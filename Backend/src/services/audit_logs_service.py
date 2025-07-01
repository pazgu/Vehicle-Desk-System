from sqlalchemy import func, cast, Text
from src.models.audit_log_model import AuditLog

def filter_audit_logs(
    query,
    entity_id: Optional[str] = None,
    action: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    user_id: Optional[str] = None
):
    if entity_id:
        query = query.filter(AuditLog.entity_id == entity_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if from_date:
        query = query.filter(AuditLog.created_at >= from_date)
    if to_date:
        query = query.filter(AuditLog.created_at <= to_date)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if user_id:
        query = query.filter(
            (cast(AuditLog.change_data['new']['supervisor_id'], Text) == user_id) |
            (cast(AuditLog.change_data['old']['supervisor_id'], Text) == user_id)
        )
    return query.order_by(AuditLog.created_at.desc())


from src.schemas.audit_log_schema import AuditLogSchema

def get_audit_logs(db: Session,entity_id: Optional[str] = None,action: Optional[str] = None,from_date: Optional[datetime] = None,to_date: Optional[datetime] = None,user_id: Optional[str] = None
    changed_by: Optional[str] = None) -> List[AuditLogSchema]:
    query = db.query(AuditLog)
    query = filter_audit_logs(query, entity_id, action, from_date, to_date, user_id, changed_by)

    rows = query.all()
    return [AuditLogSchema.from_orm(row) for row in rows]


# def get_audit_log_by_id(db: Session, audit_log_id: int) -> AuditLogSchema:
#     audit_log = db.query(AuditLog).filter(AuditLog.id == audit_log_id).first()

#     if not audit_log:
#         raise HTTPException(status_code=404, detail="Audit log not found")

#     return AuditLogSchema.from_orm(audit_log)
