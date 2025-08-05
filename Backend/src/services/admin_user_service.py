from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from uuid import uuid4
from typing import Optional

from ..schemas.register_schema import UserCreate
from ..models.user_model import User, UserRole
from ..models.department_model import Department
from ..utils.auth import hash_password
from ..schemas.user_response_schema import PaginatedUserResponse


def create_user_by_admin(user_data: UserCreate, changed_by, db: Session):
    # Check for existing user
    existing_user = db.query(User).filter(
        (User.email == user_data.email) | (User.username == user_data.username)
    ).first()

    if existing_user:
        raise HTTPException(status_code=400, detail="Email or username already in use.")

    # Create new user with only the fields that exist in your User model
    new_user = User(
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        username=user_data.username,
        email=user_data.email,
        phone=user_data.phone,
        employee_id=user_data.employee_id or str(uuid4()),
        role=user_data.role,
        department_id=user_data.department_id,
        password=hash_password(user_data.password),
        has_government_license=user_data.has_government_license,
        license_file_url=user_data.license_file_url,
        license_expiry_date= user_data.license_expiry_date
    )

    try:
        db.add(new_user)
        db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(changed_by)})
        db.commit()
        db.refresh(new_user)
        
        # Handle supervisor role
        if user_data.role == UserRole.supervisor:
            department = db.query(Department).filter(Department.id == user_data.department_id).first()
            if not department:
                db.rollback()
                raise HTTPException(status_code=404, detail="Department not found")
            department.supervisor_id = new_user.employee_id
            db.commit()

        # Return the created user data
        created_user = {
            "first_name": new_user.first_name,
            "last_name": new_user.last_name,
            "username": new_user.username,
            "email": new_user.email,
            "phone": new_user.phone,
            "employee_id": new_user.employee_id,
            "role": new_user.role,
            "department_id": new_user.department_id,
            "has_government_license": new_user.has_government_license,
            "license_file_url": new_user.license_file_url,
        }

        return created_user
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")


def get_users_service(
    db: Session,
    page: int = 1,
    page_size: int = 20,
    role: Optional[UserRole] = None,
    search: Optional[str] = None
) -> PaginatedUserResponse:
    query = db.query(User)

    if role:
        query = query.filter(User.role == role)

    if search:
        search = search.lower() 
        pattern = f"%{search}%"
        query = query.filter(
            (User.first_name.ilike(pattern)) |
            (User.last_name.ilike(pattern)) |
            (User.email.ilike(pattern))
        )

    total = query.count()

    users = (
        query
        .order_by(User.first_name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return PaginatedUserResponse(
        total=total,
        users=users
    )