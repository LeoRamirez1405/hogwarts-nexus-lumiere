import uuid

from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint, Text, Boolean
from sqlalchemy.orm import relationship

from ..database import Base
from app.utils.dates import utcnow


class ArticleSubscription(Base):
    __tablename__ = "article_subscriptions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    article_id = Column(String, ForeignKey("articles.id"), nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    user = relationship("User", lazy="selectin")
    article = relationship("Article", lazy="selectin")

    __table_args__ = (UniqueConstraint("user_id", "article_id", name="uq_user_article"),)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    type = Column(String, nullable=False)  # article_created, post_like, mention, etc.
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    related_id = Column(String, nullable=True)
    # Who triggered the notification (for avatars and "X y N mas" aggregation).
    actor_id = Column(String, ForeignKey("users.id"), nullable=True)
    read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    user = relationship("User", foreign_keys=[user_id], back_populates="notifications", lazy="selectin")
    actor = relationship("User", foreign_keys=[actor_id], lazy="selectin")