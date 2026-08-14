import uuid

from sqlalchemy import Column, String, DateTime, Text, ForeignKey, PrimaryKeyConstraint
from sqlalchemy.orm import relationship

from ..database import Base
from app.utils.dates import utcnow


class Post(Base):
    __tablename__ = "posts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    author_id = Column(String, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    image_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    edited_at = Column(DateTime, nullable=True)
    edited_by = Column(String, ForeignKey("users.id"), nullable=True)

    author = relationship("User", foreign_keys=[author_id], back_populates="posts", lazy="selectin")
    edits_by_user = relationship("User", foreign_keys=[edited_by], lazy="selectin")
    likes = relationship("PostLike", back_populates="post", lazy="selectin")
    reposts = relationship(
        "PostRepost",
        back_populates="post",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    comments = relationship(
        "PostComment",
        back_populates="post",
        lazy="selectin",
        cascade="all, delete-orphan",
    )


class PostLike(Base):
    __tablename__ = "post_likes"

    post_id = Column(String, ForeignKey("posts.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (
        PrimaryKeyConstraint("post_id", "user_id"),
    )

    post = relationship("Post", back_populates="likes", lazy="selectin")
    user = relationship("User", lazy="selectin")


class PostRepost(Base):
    __tablename__ = "post_reposts"

    post_id = Column(String, ForeignKey("posts.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (
        PrimaryKeyConstraint("post_id", "user_id"),
    )

    post = relationship("Post", back_populates="reposts", lazy="selectin")
    user = relationship("User", lazy="selectin")


class PostComment(Base):
    __tablename__ = "post_comments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    post_id = Column(String, ForeignKey("posts.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    parent_id = Column(String, ForeignKey("post_comments.id"), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    post = relationship("Post", back_populates="comments", lazy="selectin")
    user = relationship("User", lazy="selectin")
    parent = relationship("PostComment", remote_side=[id], lazy="selectin")
