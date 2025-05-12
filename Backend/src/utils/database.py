# src/utils/database.py

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
from sqlalchemy.exc import SQLAlchemyError
import logging
from src.models.base import Base  # Only import Base — NO model imports here!

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Use local or Docker DB URL
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:DaTApAss2307@localhost:5432/VehicleDB")

try:
    engine = create_engine(DATABASE_URL, echo=True)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    logger.info("Database connection established successfully")
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
