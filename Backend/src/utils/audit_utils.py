from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from uuid import UUID
import json

def log_action(db, action, entity_type, entity_id, change_data, changed_by):
    db.execute(
        text("""
            INSERT INTO audit_logs (action, entity_type, entity_id, change_data, changed_by)
            VALUES (:action, :entity_type, :entity_id, :change_data, :changed_by)
        """),
        {
            "action": action,
            "entity_type": entity_type,
            "entity_id": str(entity_id),
            "change_data": json.dumps(change_data),  # ensure this is a JSON-encoded string
            "changed_by": changed_by
        }
    )
