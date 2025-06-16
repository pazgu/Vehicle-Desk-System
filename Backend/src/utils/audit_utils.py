from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
import json

def log_action(
    db, action, entity_type, entity_id, change_data, changed_by,
    checkbox_values, inspected_at, inspector_id, notes: Optional[str] = None
):
    db.execute(
        text("""
            INSERT INTO audit_logs (
                action, entity_type, entity_id, change_data, changed_by,
                checkbox_values, inspected_at, inspector_id, notes
            )
            VALUES (
                :action, :entity_type, :entity_id, :change_data, :changed_by,
                :checkbox_values, :inspected_at, :inspector_id, :notes
            )
        """),
        {
            "action": action,
            "entity_type": entity_type,
            "entity_id": str(entity_id),
            "change_data": json.dumps(change_data),
            "changed_by": str(changed_by),
            "checkbox_values": json.dumps(checkbox_values) if checkbox_values is not None else None,
            "inspected_at": inspected_at,
            "inspector_id": str(inspector_id) if inspector_id else None,
            "notes": notes
        }
    )