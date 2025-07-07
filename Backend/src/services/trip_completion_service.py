from sqlalchemy.orm import Session
from src.models.ride_approval_model import RideApproval

def get_critical_trip_issues(db: Session):
    return db.query(RideApproval).filter(RideApproval.severity == 'critical').all()
