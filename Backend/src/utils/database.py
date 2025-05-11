from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from sqlalchemy.exc import SQLAlchemyError
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Check if we're running locally or in Docker
# In local development, use 'localhost' instead of 'db'
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:Sara3211@localhost:5432/VehicleDB")

try:
    engine = create_engine(DATABASE_URL, echo=True)  # Added echo=True for debugging
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base = declarative_base()
    logger.info(f"Database connection established successfully")
except SQLAlchemyError as e:
    logger.error(f"Database connection error: {e}")

def get_db():
    db = SessionLocal()
    try:
        yield db
    except SQLAlchemyError as e:
        logger.error(f"Database session error: {e}")
        db.rollback()
        raise
    finally:
        db.close()