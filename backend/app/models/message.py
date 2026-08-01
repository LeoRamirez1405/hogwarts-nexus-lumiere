import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, Text, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from ..database import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    sender_id = Column(String, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(String, ForeignKey("users.id"), nullable=True)
    room_id = Column(String, ForeignKey("chat_rooms.id"), nullable=True)
    reply_to_id = Column(String, ForeignKey("messages.id"), nullable=True)
    forwarded_from_id = Column(String, ForeignKey("messages.id"), nullable=True)
    forwarded = Column(Boolean, default=False, nullable=False)
    starred = Column(Boolean, default=False, nullable=False)
    disappear_at = Column(DateTime, nullable=True)
    scheduled_at = Column(DateTime, nullable=True)

    kind = Column(String, default="text", nullable=False)
    # text / image / video / audio / document / sticker / poll / voice
    body = Column(Text, nullable=True)
    attachment_url = Column(String, nullable=True)
    attachment_type = Column(String, nullable=True)  # mime type
    attachment_name = Column(String, nullable=True)
    metadata_json = Column(Text, nullable=True)  # JSON string: polls, transcriptions
    read = Column(Boolean, default=False, nullable=False)
    pinned = Column(Boolean, default=False, nullable=False)
    edited = Column(Boolean, default=False, nullable=False)
    edited_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    sender = relationship(
        "User",
        foreign_keys=[sender_id],
        back_populates="sent_messages",
        lazy="selectin",
    )
    receiver = relationship(
        "User",
        foreign_keys=[receiver_id],
        back_populates="received_messages",
        lazy="selectin",
    )
    room = relationship(
        "ChatRoom",
        back_populates="messages",
        lazy="selectin",
    )
    poll = relationship(
        "Poll",
        back_populates="message",
        cascade="all, delete-orphan",
        lazy="selectin",
        uselist=False,
    )
    reply_to = relationship(
        "Message",
        remote_side="Message.id",
        foreign_keys=[reply_to_id],
        lazy="selectin",
    )
    reactions = relationship(
        "MessageReaction",
        back_populates="message",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class Poll(Base):
    __tablename__ = "polls"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    message_id = Column(
        String, ForeignKey("messages.id"), nullable=False, unique=True
    )
    question = Column(Text, nullable=False)
    multi_choice = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    message = relationship("Message", back_populates="poll", lazy="selectin")
    options = relationship(
        "PollOption",
        back_populates="poll",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class PollOption(Base):
    __tablename__ = "poll_options"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    poll_id = Column(String, ForeignKey("polls.id"), nullable=False)
    label = Column(String, nullable=False)
    option_index = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    poll = relationship("Poll", back_populates="options", lazy="selectin")
    votes = relationship(
        "PollVote",
        back_populates="option",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class PollVote(Base):
    __tablename__ = "poll_votes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    poll_id = Column(String, ForeignKey("polls.id"), nullable=False)
    option_id = Column(String, ForeignKey("poll_options.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    option = relationship("PollOption", back_populates="votes", lazy="selectin")


class MessageReaction(Base):
    __tablename__ = "message_reactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    message_id = Column(String, ForeignKey("messages.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    emoji = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    message = relationship("Message", back_populates="reactions", lazy="selectin")
