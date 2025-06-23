from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from ..models.user_model import User
from ..models.department_model import Department  # Import the Department model
from ..schemas.register_schema import UserCreate
from ..utils.auth import hash_password
from ..services.auth_service import create_access_token
from ..utils.database import SessionLocal
import uuid
from sqlalchemy import text



def create_user(user_data: UserCreate, db: Session):
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

    
        new_user = User(
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            username=user_data.username,
            email=user_data.email,
            password=hash_password(user_data.password),
            role=user_data.role,
            department_id=department_id
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        # After user is created, update the last audit log for this user
        from ..models.audit_log_model import AuditLog  # Adjust import as needed

        last_audit = db.query(AuditLog).filter(
            AuditLog.entity_type == "User",
            AuditLog.entity_id == str(new_user.employee_id),
            AuditLog.action == "INSERT"
        ).order_by(AuditLog.created_at.desc()).first()

        if last_audit and last_audit.changed_by is None:
            last_audit.changed_by = new_user.employee_id
            db.execute(text("SET session.audit.user_id = :user_id"), {"user_id": str(new_user.employee_id)})
            db.commit()

        token_data = create_access_token(
            employee_id=str(new_user.employee_id),
            username=new_user.username,
            first_name=new_user.first_name,
            last_name=new_user.last_name,
            role=new_user.role,
            department_id=new_user.department_id  
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
        result = [{"id": dept.id, "name": dept.name} for dept in departments]
        return result
    
    finally:
        session.close()  # Make sure to close the session

