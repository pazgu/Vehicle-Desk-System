from datetime import datetime, time
import pytz

def is_time_in_blocked_window(start_datetime: datetime) -> bool:
    
    israel = pytz.timezone("Asia/Jerusalem")
    local_time = start_datetime.astimezone(israel).time()

    blocked_start = time(10, 0)
    blocked_end = time(13, 0)
    
    return blocked_start <= local_time <= blocked_end
