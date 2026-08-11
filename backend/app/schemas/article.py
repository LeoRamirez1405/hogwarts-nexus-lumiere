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
    pinned: bool = False


class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    featured: Optional[bool] = None
    pinned: Optional[bool] = None


class ArticleResponse(BaseModel):
    id: str
    title: str
    body: str
    author_id: str
    author: Optional[UserResponse] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    featured: bool
    pinned: bool = False
    created_at: datetime
    subscribed: bool = False

    class Config:
        from_attributes = True


class ArticleCommentCreate(BaseModel):
    body: str
    parent_id: Optional[str] = None


class ArticleCommentResponse(BaseModel):
    id: str
    article_id: str
    user_id: str
    body: str
    parent_id: Optional[str] = None
    replies: list["ArticleCommentResponse"] = []
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


from .announcement import AnnouncementResponse, ClassifiedResponse  # noqa: E402


class NewsFullStateResponse(BaseModel):
    """All state needed by the news page, in one call.

    Consolidates: articles (paginated), featured articles (paginated),
    announcements, classifieds, and saved articles (subscriptions).

    `articles` and `featured_articles` are paginated server-side (limit 9 by
    default). Use the matching `*_total`/`*_has_more` fields to drive a
    "Cargar más" button in the UI, and call `/articles/` with `offset`/`limit`
    and `featured_only=true` to fetch the next pages.
    """
    articles: list[ArticleResponse]
    articles_total: int
    articles_skip: int
    articles_limit: int
    articles_has_more: bool
    featured_articles: list[ArticleResponse]
    featured_articles_total: int
    featured_articles_skip: int
    featured_articles_limit: int
    featured_articles_has_more: bool
    announcements: list[AnnouncementResponse]
    classifieds: list[ClassifiedResponse]
    saved_articles: list[ArticleResponse]
    saved_articles_total: int
    saved_articles_skip: int
    saved_articles_limit: int
    saved_articles_has_more: bool
