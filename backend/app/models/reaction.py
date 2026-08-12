"""Reaction models for posts, comments, forum threads, articles, etc."""

import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import relationship

from ..database import Base


class Reaction(Base):
    """Generic emoji reaction on any content (posts, comments, forum, articles)."""

    __tablename__ = "reactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    target_type = Column(String, nullable=False)
    target_id = Column(String, nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    emoji = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "target_type",
            "target_id",
            "user_id",
            "emoji",
            name="uq_reactions_target_user_emoji",
        ),
        Index("ix_reactions_target", "target_type", "target_id"),
        Index("ix_reactions_user", "user_id"),
    )

    user = relationship("User", lazy="selectin")
