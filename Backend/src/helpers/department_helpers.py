from sqlalchemy import func, text
from sqlalchemy.orm import Session

from ..utils.auth import get_current_user
from ..models.department_model import Department
from uuid import UUID
from ..models.user_model import User


def get_or_create_vip_department(db: Session,user_id:str):
    vip_name = "VIP"

    dep = db.query(Department).filter(
        func.lower(Department.name) == vip_name.lower()
    ).first()

    if dep:
        return dep
    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user_id)})

    new_dep = Department(name=vip_name)
    db.add(new_dep)
    db.commit()
    db.refresh(new_dep)
    return new_dep

def is_vip_department(db: Session, user_id: UUID) -> bool:
    user = db.query(User).filter(User.employee_id == user_id).first()
    if not user or not user.department_id:
        return False
    
    department = db.query(Department).filter(Department.id == user.department_id).first()
    if department and department.name == "VIP":
        return True
    
    return False
