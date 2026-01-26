from sqlalchemy.orm import Session
from src.models.ride_requirements import RideRequirement
from src.schemas.ride_requirements_schema import RideRequirementUpdate
from typing import Optional
from datetime import datetime


def get_latest_requirement(db: Session) -> Optional[RideRequirement]:
    return db.query(RideRequirement).order_by(RideRequirement.updated_at.desc()).first()


def create_requirement(db: Session, data: RideRequirementUpdate) -> RideRequirement:
    """Create a new ride requirements record."""
    new_req = RideRequirement(
        items=data.items,
        title="Vehicle Requirements",
        updated_by=data.updated_by,
        updated_at=datetime.utcnow(),
    )
    db.add(new_req)
    db.commit()
    db.refresh(new_req)
    return new_req


def update_requirement(db: Session, data: RideRequirementUpdate) -> RideRequirement:
    """Full update (used for PUT)"""
    existing = get_latest_requirement(db)
    if not existing:
        return create_requirement(db, data)

    existing.items = data.items
    existing.title = "Vehicle Requirements"
    existing.updated_by = data.updated_by
    existing.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(existing)
    return existing
