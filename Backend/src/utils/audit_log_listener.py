import os
from dotenv import load_dotenv
import psycopg2
import select
import json
from .socket_manager import sio
import asyncio
import threading
from ..models.user_model import User  # Adjust import as needed
from ..utils.database import SessionLocal  # Adjust import as needed

load_dotenv()  # Loads variables from .env

def listen_for_audit_logs():
    db_url = os.environ["DATABASE_URL"]
    conn = psycopg2.connect(db_url)
    conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()
    cur.execute("LISTEN audit_log_channel;")

    # Create and set a new event loop for this thread
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    threading.Thread(target=loop.run_forever, daemon=True).start()

    while True:
        if select.select([conn], [], [], 5) == ([], [], []):
            continue
        conn.poll()
        while conn.notifies:
            try:
                notify = conn.notifies.pop(0)
                payload = json.loads(notify.payload)
                user_id = payload.get("user_id") or payload.get("changed_by")
                db = SessionLocal()
                user = None
                if user_id:
                    user = db.query(User).filter(User.employee_id == user_id).first()
                if user:
                    payload["full_name"] = f"{user.first_name} {user.last_name}"
                    payload["changed_by"] = str(user.employee_id)
                else:
                    # Try to get name from change_data for user INSERTs
                    change_data = payload.get("change_data", {})
                    if isinstance(change_data, str):
                        change_data = json.loads(change_data)
                    first_name = change_data.get("first_name", "")
                    last_name = change_data.get("last_name", "")
                    if first_name or last_name:
                        payload["full_name"] = f"{first_name} {last_name}".strip()
                    else:
                        payload["full_name"] = ""
                    # Set changed_by to entity_id if missing
                    if not payload.get("changed_by"):
                        payload["changed_by"] = payload.get("entity_id", "")
                db.close()
                asyncio.run_coroutine_threadsafe(sio.emit("audit_log_updated", payload), loop)
            except Exception as e:
                print("Error emitting audit log:", e)