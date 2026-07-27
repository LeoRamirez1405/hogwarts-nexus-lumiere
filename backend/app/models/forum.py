import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    Text,
    ForeignKey,
    PrimaryKeyConstraint,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from ..database import Base


class ForumThread(Base):
    __tablename__ = "forum_threads"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    author_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    category = Column(String, nullable=False, default="General")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    author = relationship("User", lazy="selectin")


class ForumThreadVote(Base):
    __tablename__ = "forum_thread_votes"

    thread_id = Column(String, ForeignKey("forum_threads.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    value = Column(Integer, nullable=False, default=1)  # +1 or -1
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (PrimaryKeyConstraint("thread_id", "user_id"),)


class ForumComment(Base):
    __tablename__ = "forum_comments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    thread_id = Column(String, ForeignKey("forum_threads.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", lazy="selectin")


class ForumSubscription(Base):
    __tablename__ = "forum_subscriptions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    thread_id = Column(String, ForeignKey("forum_threads.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("thread_id", "user_id", name="uq_forum_thread_user"),
    )
