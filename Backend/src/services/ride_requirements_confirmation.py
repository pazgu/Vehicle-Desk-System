from sqlalchemy.orm import Session
from datetime import datetime
from src.models.ride_requirements_confirmation import RideRequirementConfirmation
from uuid import UUID


def create_or_update_confirmation(
    db: Session,
    ride_id: UUID,
    user_id: UUID,
    confirmed: bool
) -> RideRequirementConfirmation:
    existing = (
        db.query(RideRequirementConfirmation)
        .filter_by(ride_id=ride_id, user_id=user_id)
        .first()
    )

    if existing:
        existing.confirmed = confirmed
        existing.confirmed_at = datetime.utcnow()
    else:
        existing = RideRequirementConfirmation(
            ride_id=ride_id,
            user_id=user_id,
            confirmed=confirmed,
            confirmed_at=datetime.utcnow()
        )
        db.add(existing)

    db.commit()
    db.refresh(existing)
    return existing

