import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, Text, UniqueConstraint, Boolean
from sqlalchemy.orm import relationship


from ..database import Base


class ChatRoom(Base):
    __tablename__ = "chat_rooms"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    avatar_url = Column(String, nullable=True)
    type = Column(String, default="group", nullable=False)  # group / direct
    closed = Column(Boolean, default=False, nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    members = relationship(
        "ChatRoomMember",
        back_populates="room",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    messages = relationship(
        "Message",
        back_populates="room",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    creator = relationship(
        "User",
        lazy="selectin",
        foreign_keys=[created_by],
        overlaps="chat_rooms_created",
        viewonly=True,
    )


class ChatRoomMember(Base):
    __tablename__ = "chat_room_members"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    room_id = Column(String, ForeignKey("chat_rooms.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    role = Column(String, default="member", nullable=False)  # member / admin
    muted_until = Column(DateTime, nullable=True)  # None = not muted, datetime = muted until
    last_read_at = Column(DateTime, nullable=True)  # last time this member read the room
    joined_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    room = relationship("ChatRoom", back_populates="members", lazy="selectin")
    user = relationship("User", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("room_id", "user_id", name="uq_room_user"),
    )


class UserConversationPreference(Base):
    __tablename__ = "user_conversation_preferences"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    conversation_type = Column(String, nullable=False)  # "dm" | "room"
    conversation_id = Column(String, nullable=False)  # user_id for DM, room_id for room
    hidden = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("user_id", "conversation_type", "conversation_id", name="uq_user_conv_pref"),
    )
