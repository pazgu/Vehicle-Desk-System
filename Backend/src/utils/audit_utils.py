from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from uuid import UUID
import json

def log_action(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: str,
    change_data: dict,
    changed_by: Optional[UUID] = None
):
    db.execute(text("""
        INSERT INTO audit_logs (action, entity_type, entity_id, change_data, changed_by)
        VALUES (:action, :entity_type, :entity_id, :change_data::jsonb, :changed_by)
    """), {
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "change_data": json.dumps(change_data),
        "changed_by": str(changed_by) if changed_by else None
    })
    db.commit()
