from sqlalchemy.orm import Session
from uuid import UUID
from ..models.department_model import Department
from src.models.user_model import User

def get_user_by_id(db: Session, user_id: UUID) -> User | None:
    user = db.query(User).filter(User.employee_id == user_id).first()
    if user and user.role == "supervisor" and not user.department_id:
        dept = db.query(Department).filter(Department.supervisor_id == user.employee_id).first()
        if dept:
            user.department_id = dept.id
    return user
def get_all_users(db: Session):
    return db.query(User).all()



def get_user_department(user_id: UUID, db: Session) -> UUID | None:
    user = db.query(User).filter(User.employee_id == user_id).first()
    return user.department_id if user else None


def get_user_email(db: Session, user_id: UUID) -> str | None:
    user = db.query(User).filter(User.employee_id == user_id).first()
    return user.email if user else None
