import uuid

from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from ..database import Base
from app.utils.dates import utcnow


class FriendRequest(Base):
    __tablename__ = "friend_requests"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    sender_id = Column(String, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(String, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="pending", nullable=False)  # pending / accepted / rejected
    created_at = Column(DateTime, default=utcnow, nullable=False)

    sender = relationship("User", foreign_keys=[sender_id], lazy="selectin")
    receiver = relationship("User", foreign_keys=[receiver_id], lazy="selectin")

    __table_args__ = (
        UniqueConstraint("sender_id", "receiver_id", name="unique_friend_request"),
    )
