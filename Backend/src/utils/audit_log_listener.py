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
    print("Listening for audit log notifications...")

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
                if user_id:
                    db = SessionLocal()
                    user = db.query(User).filter(User.employee_id == user_id).first()
                    if user:
                        payload["full_name"] = f"{user.first_name} {user.last_name}"
                    else:
                        print(f"User not found for user_id: {user_id}")
                    db.close()
                asyncio.run_coroutine_threadsafe(sio.emit("audit_log_updated", payload), loop)
            except Exception as e:
                print("Error emitting audit log:", e)