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
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    articles = relationship("Article", back_populates="author", lazy="selectin")
    posts = relationship("Post", back_populates="author", lazy="selectin")
    sent_messages = relationship("Message", foreign_keys="Message.sender_id", back_populates="sender", lazy="selectin")
    received_messages = relationship("Message", foreign_keys="Message.receiver_id", back_populates="receiver", lazy="selectin")
    creatures = relationship("UserCreature", back_populates="user", lazy="selectin")
    transactions_sent = relationship("Transaction", foreign_keys="Transaction.sender_id", back_populates="sender", lazy="selectin")
    transactions_received = relationship("Transaction", foreign_keys="Transaction.receiver_id", back_populates="receiver", lazy="selectin")
