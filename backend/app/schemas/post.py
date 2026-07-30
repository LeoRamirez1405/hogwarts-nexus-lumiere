from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from .user import UserResponse


class PostCreate(BaseModel):
    body: str
    image_url: Optional[str] = None


class CommentCreate(BaseModel):
    body: str


class CommentResponse(BaseModel):
    id: str
    post_id: str
    user_id: str
    author: Optional[UserResponse] = None
    body: str
    created_at: datetime

    class Config:
        from_attributes = True


class PostUpdate(BaseModel):
    body: str
    image_url: Optional[str] = None


class PostResponse(BaseModel):
    id: str
    author_id: str
    author: Optional[UserResponse] = None
    body: str
    image_url: Optional[str] = None
    created_at: datetime
    edited_at: Optional[datetime] = None
    edited_by: Optional[UserResponse] = None
    likes_count: int = 0
    liked_by_me: bool = False
    reposts_count: int = 0
    reposted_by_me: bool = False
    comments_count: int = 0
    # Repost feed metadata (populated when the item is a repost on a profile feed)
    is_repost: bool = False
    reposted_by: Optional[UserResponse] = None
    reposted_at: Optional[datetime] = None

    class Config:
        from_attributes = True
