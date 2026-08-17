import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import relationship

from ..database import Base
from app.utils.dates import utcnow


class FCMToken(Base):
    __tablename__ = "fcm_tokens"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=False)  # "android" | "ios" | "web"
    user_agent = Column(String, nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    last_used_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="fcm_tokens", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("user_id", "token", name="uq_user_fcm_token"),
        Index("ix_fcm_tokens_user_active", "user_id", "active"),
    )