from sqlalchemy import text
from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session
from uuid import UUID
from src.utils.auth import token_check 

from ..models.department_model import Department
from ..models.user_model import User, UserRole
from ..schemas.department_schema import DepartmentCreate, DepartmentUpdate

def create_department(db: Session, dept_data: DepartmentCreate, payload: dict):
    user_id_from_token = payload.get("user_id") or payload.get("sub")
    if db.query(Department).filter_by(name=dept_data.name).first():
        raise HTTPException(status_code=409, detail="Department name already exists")
    supervisor = db.query(User).filter_by(employee_id=dept_data.supervisor_id).first()
    if not supervisor:
        raise HTTPException(status_code=404, detail="Supervisor not found")
    if supervisor.role != UserRole.supervisor:
        raise HTTPException(status_code=400, detail="User is not a supervisor")
    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user_id_from_token)})
    new_dept = Department(name=dept_data.name, supervisor_id=dept_data.supervisor_id)
    db.add(new_dept)
    db.commit()
    db.refresh(new_dept)
    supervisor.department_id = new_dept.id
    db.commit()
    db.execute(text("SET session.audit.user_id = DEFAULT"))
    return new_dept


def update_department(db: Session, dept_id: UUID, dept_data: DepartmentUpdate, payload: dict):
    user_id_from_token = payload.get("user_id") or payload.get("sub")
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

    db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user_id_from_token)})

    db.commit()
    db.refresh(department)
    db.execute(text("SET session.audit.user_id = DEFAULT"))

    return department

# In department_service.py

def delete_department(db: Session, department_id: str, payload: dict):
    # Retrieve the department to be deleted
    department = db.query(Department).filter_by(id=department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    # Get the "Unassigned" department to reassign users
    unassigned_dept_name = "Unassigned"
    unassigned_dept = db.query(Department).filter_by(name=unassigned_dept_name).first()

    if not unassigned_dept:
        # Create the "Unassigned" department and assign the supervisor of the deleted department to it.
        supervisor_to_demote = db.query(User).filter_by(employee_id=department.supervisor_id).first()
        if not supervisor_to_demote:
            raise HTTPException(
                status_code=404,
                detail="Supervisor of the department to be deleted not found."
            )
        
        # Now, create the Unassigned department with this user as supervisor
        unassigned_dept = Department(name=unassigned_dept_name, supervisor_id=supervisor_to_demote.employee_id)
        db.add(unassigned_dept)
        db.commit()
        db.refresh(unassigned_dept)

    # Reassign users from the old department to the new "Unassigned" department
    users_in_department = db.query(User).filter(User.department_id == department_id).all()
    
    # Reassign users and demote the supervisor of the deleted department
    if users_in_department:
        for user in users_in_department:
            if user.role == UserRole.supervisor and user.employee_id == department.supervisor_id:
                # The supervisor of the deleted department becomes a regular employee in the Unassigned department.
                user.role = UserRole.employee
            
            # All users from the deleted department are now assigned to the "Unassigned" department.
            user.department_id = unassigned_dept.id
        
        # Apply audit trail user
        user_id_from_token = payload.get("user_id") or payload.get("sub")
        db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(user_id_from_token)})

        db.commit()

    # Now, the department can be safely deleted
    db.delete(department)
    db.commit()
    
    db.execute(text("SET session.audit.user_id = DEFAULT"))

    return {"message": "Department deleted successfully"}


def get_unassigned_department(db: Session) -> Department:
    unassigned_dept_name = "Unassigned"
    unassigned_department = db.query(Department).filter_by(name=unassigned_dept_name).first()
    
    if not unassigned_department:
        # Create a placeholder user to satisfy the foreign key constraint
        # NOTE: This assumes you have a way to create a user for this purpose.
        # It's better to manually create the "Unassigned" department and a dummy supervisor for it.
        # For simplicity, we'll assume a dummy user 'dummy-supervisor' exists.
        
        dummy_supervisor = db.query(User).filter_by(username='dummy-supervisor').first()
        if not dummy_supervisor:
            raise HTTPException(
                status_code=500,
                detail="Dummy supervisor for unassigned department not found. Please create it first."
            )
            
        unassigned_department = Department(name=unassigned_dept_name, supervisor_id=dummy_supervisor.employee_id)
        db.add(unassigned_department)
        db.commit()
        db.refresh(unassigned_department)
    
    return unassigned_department