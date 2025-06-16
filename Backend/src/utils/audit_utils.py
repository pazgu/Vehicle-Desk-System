from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
import json
from datetime import datetime 

def log_action(
    db,
    action,
    entity_type,
    entity_id,
    change_data,
    changed_by,
    checkbox_value: Optional[bool] = False,
    inspected_at: Optional[datetime] = None,
    notes: Optional[str] = None
):
    # Use current time if inspected_at not provided
    final_inspected_at = inspected_at if inspected_at is not None else datetime.utcnow()

from ..utils.socket_manager import sio  # Import your Socket.IO manager


def log_action(db, action, entity_type, entity_id, change_data, changed_by):
    # ...existing code...
    db.execute(
        text("""
            INSERT INTO audit_logs (
                action, entity_type, entity_id, change_data, changed_by,
                checkbox_value, inspected_at, notes
            )
            VALUES (
                :action, :entity_type, :entity_id, :change_data, :changed_by,
                :checkbox_value, :inspected_at, :notes
            )
        """),
        {
            "action": action,
            "entity_type": entity_type,
            "entity_id": str(entity_id) if entity_id is not None else None,
            "change_data": json.dumps(change_data) if change_data is not None else None,
            "changed_by": str(changed_by) if changed_by is not None else None,
            "checkbox_value": checkbox_value,
            "inspected_at": final_inspected_at,
            "notes": notes
            "entity_id": str(entity_id),
            "change_data": json.dumps(change_data),
            "changed_by": str(changed_by)
        }
    )
    

    # Fetch the latest audit log entry (assuming 'id' is auto-increment)
    audit_log = db.execute(
        text("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 1")
    ).fetchone()
    
    # Emit socket event for real-time updates
    import asyncio
    if audit_log:
        log_dict = dict(audit_log)
        try:
            asyncio.create_task(
                sio.emit("audit_log_updated", log_dict)
            )
        except RuntimeError:
            loop = asyncio.get_event_loop()
            loop.create_task(
                sio.emit("audit_log_updated", log_dict)
            )