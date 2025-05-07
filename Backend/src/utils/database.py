from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
# from .app_config import AppConfig


# engine = create_engine(AppConfig.database_url)
# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

mydb=get_db()
