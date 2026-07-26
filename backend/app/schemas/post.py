from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

from .user import UserResponse


class PostCreate(BaseModel):
    body: str
    image_url: Optional[str] = None


class PostResponse(BaseModel):
    id: str
    author_id: str
    author: Optional[UserResponse] = None
    body: str
    image_url: Optional[str] = None
    created_at: datetime
    likes_count: int = 0
    liked_by_me: bool = False

    class Config:
        from_attributes = True
