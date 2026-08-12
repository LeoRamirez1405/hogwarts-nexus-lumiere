import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text
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
    house_points = Column(Integer, default=0, nullable=False)
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
    sanctuary_penalty = Column(Integer, default=0, nullable=False)  # accumulated penalties from neglect
    receive_marketplace_notifications = Column(Boolean, default=True, nullable=False)  # admin: receive purchase alerts
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Collection relationships are lazy="raise" on purpose: they are NEVER
    # needed when serializing a User (the schemas only read scalar columns) and
    # eager-loading all 11 of them made every login / auth/me / user listing
    # fire 11 extra queries. Code that truly needs a collection must load it
    # with an explicit selectinload() instead of relying on a hidden cascade.
    articles = relationship("Article", back_populates="author", lazy="raise")
    posts = relationship("Post", foreign_keys="Post.author_id", back_populates="author", lazy="raise")
    sent_messages = relationship("Message", foreign_keys="Message.sender_id", back_populates="sender", lazy="raise")
    received_messages = relationship("Message", foreign_keys="Message.receiver_id", back_populates="receiver", lazy="raise")
    creatures = relationship("UserCreature", back_populates="user", lazy="raise")
    transactions_sent = relationship("Transaction", foreign_keys="Transaction.sender_id", back_populates="sender", lazy="raise")
    transactions_received = relationship("Transaction", foreign_keys="Transaction.receiver_id", back_populates="receiver", lazy="raise")
    article_subscriptions = relationship("ArticleSubscription", back_populates="user", lazy="raise")
    notifications = relationship("Notification", foreign_keys="Notification.user_id", back_populates="user", lazy="raise")
    chat_rooms = relationship("ChatRoomMember", back_populates="user", lazy="raise")
    chat_rooms_created = relationship("ChatRoom", foreign_keys="ChatRoom.created_by", lazy="raise")
    push_subscriptions = relationship("PushSubscription", back_populates="user", lazy="raise")
