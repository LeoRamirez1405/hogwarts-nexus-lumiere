import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from ..database import Base


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    # JSON string containing the PushSubscription object from the browser
    subscription_json = Column(Text, nullable=False)
    # User agent info for debugging
    user_agent = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="push_subscriptions", lazy="selectin")

    __table_args__ = (UniqueConstraint("user_id", "subscription_json", name="uq_user_subscription"),)


# Add to User model relationship (will need to update user.py)
# push_subscriptions = relationship("PushSubscription", back_populates="user", lazy="raise")