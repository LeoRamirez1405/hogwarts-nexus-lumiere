from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from .user import UserResponse


class ArticleCreate(BaseModel):
    title: str
    body: str
    category: Optional[str] = None
    image_url: Optional[str] = None
    featured: bool = False


class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    featured: Optional[bool] = None


class ArticleResponse(BaseModel):
    id: str
    title: str
    body: str
    author_id: str
    author: Optional[UserResponse] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    featured: bool
    created_at: datetime
    subscribed: bool = False

    class Config:
        from_attributes = True


class ArticleCommentCreate(BaseModel):
    body: str


class ArticleCommentResponse(BaseModel):
    id: str
    article_id: str
    user_id: str
    body: str
    created_at: datetime
    author: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class ArticleSubscriptionResponse(BaseModel):
    id: str
    user_id: str
    article_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationResponse(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    body: str
    related_id: Optional[str] = None
    actor_id: Optional[str] = None
    actor: Optional[UserResponse] = None
    read: bool
    created_at: datetime

    class Config:
        from_attributes = True
