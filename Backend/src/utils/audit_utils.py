from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from uuid import UUID
import json
from ..utils.socket_manager import sio  # Import your Socket.IO manager


def log_action(db, action, entity_type, entity_id, change_data, changed_by):
    # ...existing code...
    db.execute(
        text("""
            INSERT INTO audit_logs (action, entity_type, entity_id, change_data, changed_by)
            VALUES (:action, :entity_type, :entity_id, :change_data, :changed_by)
        """),
        {
            "action": action,
            "entity_type": entity_type,
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