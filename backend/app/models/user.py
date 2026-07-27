import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, Text
from sqlalchemy.orm import relationship

from ..database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="user", nullable=False)  # admin / user
    zerines = Column(Integer, default=0, nullable=False)
    avatar_url = Column(String, nullable=True)
    house = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    status = Column(String(80), nullable=True)
    wand = Column(String(200), nullable=True)
    location = Column(String(100), nullable=True)
    official_title = Column(String(100), nullable=True)
    last_active_at = Column(DateTime, nullable=True)
    # Lifetime pet-care counters feeding the sanctuary/user level formulas.
    care_actions = Column(Integer, default=0, nullable=False)  # feeds + plays
    items_purchased = Column(Integer, default=0, nullable=False)  # pet item units bought
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    articles = relationship("Article", back_populates="author", lazy="selectin")
    posts = relationship("Post", back_populates="author", lazy="selectin")
    sent_messages = relationship("Message", foreign_keys="Message.sender_id", back_populates="sender", lazy="selectin")
    received_messages = relationship("Message", foreign_keys="Message.receiver_id", back_populates="receiver", lazy="selectin")
    creatures = relationship("UserCreature", back_populates="user", lazy="selectin")
    transactions_sent = relationship("Transaction", foreign_keys="Transaction.sender_id", back_populates="sender", lazy="selectin")
    transactions_received = relationship("Transaction", foreign_keys="Transaction.receiver_id", back_populates="receiver", lazy="selectin")
    article_subscriptions = relationship("ArticleSubscription", back_populates="user", lazy="selectin")
    notifications = relationship("Notification", foreign_keys="Notification.user_id", back_populates="user", lazy="selectin")
    chat_rooms = relationship("ChatRoomMember", back_populates="user", lazy="selectin")
    chat_rooms_created = relationship("ChatRoom", foreign_keys="ChatRoom.created_by", lazy="selectin")
