from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from enum import Enum


class EmailStatusEnum(str, Enum):
    PENDING = "pending"
    ATTEMPTING = "attempting"
    SENT = "sent"
    FAILED = "failed"

class EmailStatusResponse(BaseModel):
    identifier_id: UUID
    email_type: str
    status: EmailStatusEnum
    message: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class RetryEmailRequest(BaseModel):
    identifier_id: UUID
    email_type: str