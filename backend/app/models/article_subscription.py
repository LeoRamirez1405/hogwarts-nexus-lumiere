import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint, Text
from sqlalchemy.orm import relationship

from ..database import Base


class ArticleSubscription(Base):
    __tablename__ = "article_subscriptions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    article_id = Column(String, ForeignKey("articles.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", lazy="selectin")
    article = relationship("Article", lazy="selectin")

    __table_args__ = (UniqueConstraint("user_id", "article_id", name="uq_user_article"),)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    type = Column(String, nullable=False)  # article_created, article_updated, etc.
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    related_id = Column(String, nullable=True)
    read = Column(String, default="false", nullable=False)  # "true" / "false"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", lazy="selectin")