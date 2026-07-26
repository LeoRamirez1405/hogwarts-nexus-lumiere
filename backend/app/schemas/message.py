from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

from .user import UserResponse


class MessageCreate(BaseModel):
    receiver_id: str
    body: str
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = None


class MessageResponse(BaseModel):
    id: str
    sender_id: str
    receiver_id: str
    body: str
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = None
    read: bool
    created_at: datetime
    sender: Optional[UserResponse] = None
    receiver: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    user: UserResponse
    last_message: Optional[MessageResponse] = None
    unread_count: int = 0
