from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session
from ..models.user_model import User
from pathlib import Path
import os
import uuid

def upload_license_file_service(db: Session, user_id: uuid.UUID, file: UploadFile):
    allowed_extensions = {".png", ".jpg", ".jpeg", ".pdf"}
    ext = Path(file.filename).suffix.lower()

    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Invalid file type. Only images and PDFs are allowed.")

    user = db.query(User).filter(User.employee_id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    upload_dir = "uploads/licenses"
    os.makedirs(upload_dir, exist_ok=True)

    filename = f"{uuid.uuid4()}{ext}"
    save_path = os.path.join(upload_dir, filename)

    with open(save_path, "wb") as buffer:
        buffer.write(file.file.read())

    user.license_file_url = f"/{upload_dir}/{filename}"
    db.commit()

    return {
        "message": "License uploaded successfully",
        "url": user.license_file_url
    }