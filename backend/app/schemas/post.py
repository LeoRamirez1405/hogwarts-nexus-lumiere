from datetime import datetime
from typing import Optional
from pydantic import BaseModel, model_validator

from .user import UserResponse


class PostCreate(BaseModel):
    body: Optional[str] = None
    image_url: Optional[str] = None

    @model_validator(mode="after")
    def at_least_one_field(self):
        """Allow posts with only an image — body becomes empty string when
        omitted, but at least one of body/image_url must be present."""
        if not (self.body or "").strip() and not (self.image_url or "").strip():
            raise ValueError("Post must have either body text or an image")
        return self


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
    body: Optional[str] = None
    image_url: Optional[str] = None

    @model_validator(mode="after")
    def at_least_one_field(self):
        if not (self.body or "").strip() and not (self.image_url or "").strip():
            raise ValueError("Post must have either body text or an image")
        return self


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
