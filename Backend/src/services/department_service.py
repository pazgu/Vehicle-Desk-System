from fastapi import HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from ..models.department_model import Department
from ..models.user_model import User, UserRole
from ..schemas.department_schema import DepartmentCreate, DepartmentUpdate

def create_department(db: Session, dept_data: DepartmentCreate):
    if db.query(Department).filter_by(name=dept_data.name).first():
        raise HTTPException(status_code=409, detail="Department name already exists")

    supervisor = db.query(User).filter_by(employee_id=dept_data.supervisor_id).first()
    if not supervisor:
        raise HTTPException(status_code=404, detail="Supervisor not found")
    if supervisor.role != UserRole.supervisor:
        raise HTTPException(status_code=400, detail="User is not a supervisor")

    new_dept = Department(name=dept_data.name, supervisor_id=dept_data.supervisor_id)
    db.add(new_dept)
    db.commit()
    db.refresh(new_dept)


    supervisor.department_id = new_dept.id
    db.commit()

    return new_dept


def update_department(db: Session, dept_id: UUID, dept_data: DepartmentUpdate):
    department = db.query(Department).filter_by(id=dept_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    if dept_data.name:
        if db.query(Department).filter(Department.name == dept_data.name, Department.id != dept_id).first():
            raise HTTPException(status_code=409, detail="Department name already exists")
        department.name = dept_data.name

    if dept_data.supervisor_id:
        supervisor = db.query(User).filter_by(employee_id=dept_data.supervisor_id).first()
        if not supervisor:
            raise HTTPException(status_code=404, detail="Supervisor not found")
        if supervisor.role != UserRole.supervisor:
            raise HTTPException(status_code=400, detail="User is not a supervisor")
        department.supervisor_id = dept_data.supervisor_id
        supervisor.department_id = dept_id

    db.commit()
    db.refresh(department)
    return department
