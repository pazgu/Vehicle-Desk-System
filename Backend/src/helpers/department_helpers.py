from sqlalchemy import func
from sqlalchemy.orm import Session
from ..models.department_model import Department



def get_or_create_vip_department(db: Session):
    vip_name = "VIP"

    dep = db.query(Department).filter(
        func.lower(Department.name) == vip_name.lower()
    ).first()

    if dep:
        return dep

    new_dep = Department(name=vip_name)
    db.add(new_dep)
    db.commit()
    db.refresh(new_dep)
    return new_dep
