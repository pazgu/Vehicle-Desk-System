from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
import logging
from ..models.user_model import User
from ..schemas.register_schema import UserCreate
from ..utils.auth import hash_password
from ..services.auth_service import create_access_token

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_user(user_data: UserCreate, db: Session):
    try:
        # Check for existing user by username, email, or employee ID
        existing_user = db.query(User).filter(
            (User.username == user_data.username) |
            (User.email == user_data.email) |
            (User.employee_id == user_data.employee_id)
        ).first()

        if existing_user:
            logger.warning(f"Registration attempt with existing credentials: {user_data.username}")
            raise ValueError("Username, email, or employee ID already exists")

        # Convert department_id to UUID if it's a string
        department_id = user_data.department_id
        
        # Log the user creation attempt
        logger.info(f"Creating new user: {user_data.username}")
        
        new_user = User(
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            username=user_data.username,
            email=user_data.email,
            employee_id=user_data.employee_id,
            password=hash_password(user_data.password),
            role=user_data.role,
            department_id=department_id
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        token_data = create_access_token(
            user_id=str(new_user.id),
            username=new_user.username,
            role=new_user.role
        )

        logger.info(f"User successfully created: {new_user.username}")
        
        return {
            "user_id": new_user.id,
            **token_data
        }
    
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during user creation: {str(e)}")
        raise ValueError(f"Database error: {str(e)}")
    
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error during user creation: {str(e)}")
        raise