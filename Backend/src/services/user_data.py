from sqlalchemy.orm import Session
from uuid import UUID
from src.models.user_model import User  # make sure this matches your actual model

def get_user_by_id(db: Session, user_id: UUID) -> User | None:
    return db.query(User).filter(User.employee_id == user_id).first()

def get_all_users(db: Session):
    return db.query(User).all()



def get_user_department(user_id: UUID, db: Session) -> UUID | None:
    user = db.query(User).filter(User.employee_id == user_id).first()
    return user.department_id if user else None


   