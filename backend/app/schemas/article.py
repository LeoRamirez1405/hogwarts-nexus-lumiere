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

    class Config:
        from_attributes = True
