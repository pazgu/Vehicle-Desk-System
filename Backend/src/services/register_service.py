from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
import uuid

from ..models.user_model import User
from ..models.department_model import Department
from ..services.auth_service import create_access_token
from ..schemas.register_schema import UserCreate
from ..utils.auth import hash_password
from ..utils.database import SessionLocal




def create_user(user_data: UserCreate, db: Session, created_by_user_id: str = None):
    try:
        # Check for existing user by username, email, or employee ID
        existing_user = db.query(User).filter(
            (User.username == user_data.username) |
            (User.email == user_data.email)
        ).first()

        if existing_user:
            raise ValueError("Username, email, or employee ID already exists")

        # Convert department_id to UUID if it's a string
        department_id = user_data.department_id

        # Set a temporary audit context FIRST
        if created_by_user_id:
            # An admin is creating this user
            db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": created_by_user_id})
        else:
            # For self-registration, we'll update this after we get the user ID
            # But we need SOMETHING now, so let's use a placeholder that we'll fix
            db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": "00000000-0000-0000-0000-000000000000"})

        new_user = User(
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            username=user_data.username,
            email=user_data.email,
            password=hash_password(user_data.password),
            role=user_data.role,
            department_id=department_id,
            has_government_license= False,
            phone=user_data.phone
        )

        db.add(new_user)
        db.flush()  # This gets the ID without committing

        # If this was self-registration, now update the audit context with the real user ID
        if not created_by_user_id:
            db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(new_user.employee_id)})

        db.commit()
        db.refresh(new_user)

        # Now fix the audit log that was created with the placeholder
        from ..models.audit_log_model import AuditLog

        if not created_by_user_id:
            # Find the audit log we just created and fix the changed_by field
            last_audit = db.query(AuditLog).filter(
                AuditLog.entity_type == "User",
                AuditLog.entity_id == str(new_user.employee_id),
                AuditLog.action == "INSERT"
            ).order_by(AuditLog.created_at.desc()).first()

            if last_audit:
                last_audit.changed_by = new_user.employee_id
                db.commit()

        token_data = create_access_token(
            user_id=str(new_user.employee_id),
            employee_id=str(new_user.employee_id),
            username=new_user.username,
            first_name=new_user.first_name,
            last_name=new_user.last_name,
            role=new_user.role,
            department_id=new_user.department_id,
            has_government_license= False,
            # license_file_url=None,
            phone=new_user.phone
        )

        
        return {
            "employee_id": new_user.employee_id,
            **token_data,
            "department_id": str(new_user.department_id)
        }
    
    except SQLAlchemyError as e:
        db.rollback()
        raise ValueError(f"Database error: {str(e)}")
    
    except Exception as e:
        db.rollback()
        raise


def get_departments():
    # Create a new session
    session = SessionLocal()
    
    try:
        # Query all departments from the database
        departments = session.query(Department).all()

        # Prepare the response as a list of dicts
        result = [{"id": dept.id, "name": dept.name, "supervisor_id": dept.supervisor_id} for dept in departments]
        return result
    
    finally:
        session.close()  # Make sure to close the session

