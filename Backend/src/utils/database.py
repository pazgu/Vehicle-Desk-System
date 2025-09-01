
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError
import os
from dotenv import load_dotenv
import logging
from ..models.base import Base

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

try:
    logger.info(f"Connecting to database at {DATABASE_URL}")
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
