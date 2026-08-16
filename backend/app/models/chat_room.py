import uuid

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, UniqueConstraint, Boolean
from sqlalchemy.orm import relationship


from ..database import Base
from app.utils.dates import utcnow


class ChatRoom(Base):
    __tablename__ = "chat_rooms"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    avatar_url = Column(String, nullable=True)
    type = Column(String, default="group", nullable=False)  # group / direct
    closed = Column(Boolean, default=False, nullable=False)
    # If True, anyone joining via invite link must be approved by an admin first
    join_approval = Column(Boolean, default=False, nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

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
    invites = relationship(
        "RoomInvite",
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


class RoomInvite(Base):
    __tablename__ = "room_invites"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    room_id = Column(String, ForeignKey("chat_rooms.id"), nullable=False)
    # Random URL-safe token used in the share link
    token = Column(String, nullable=False, unique=True, index=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    # When set, the invite expires after this time
    expires_at = Column(DateTime, nullable=True)
    # When set, the invite can only be used `max_uses` times (None = unlimited)
    max_uses = Column(Integer, nullable=True)
    uses = Column(Integer, default=0, nullable=False)
    # When True the invite is no longer visible/usable (manual revoke)
    revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    room = relationship("ChatRoom", back_populates="invites", lazy="selectin")
    creator = relationship("User", lazy="selectin", foreign_keys=[created_by])


class ChatRoomMember(Base):
    __tablename__ = "chat_room_members"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    room_id = Column(String, ForeignKey("chat_rooms.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    role = Column(String, default="member", nullable=False)  # member / admin
    muted_until = Column(DateTime, nullable=True)  # None = not muted, datetime = muted until
    last_read_at = Column(DateTime, nullable=True)  # last time this member read the room
    archived = Column(Boolean, default=False, nullable=False)
    # When True the user requested to join via invite link and is waiting
    # for admin approval (effective only when room.join_approval = True)
    pending = Column(Boolean, default=False, nullable=False)
    joined_at = Column(DateTime, default=utcnow, nullable=False)

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
    deleted_at = Column(DateTime, nullable=True)  # hard-delete cut-off: history before this ts is hidden for this user
    removed_at = Column(DateTime, nullable=True)  # long-press removal: hidden until next message, history preserved
    muted_until = Column(DateTime, nullable=True)  # None = not muted, datetime = muted until
    # Denormalized columns for conversation list performance
    last_message_id = Column(String, nullable=True)
    last_message_body = Column(Text, nullable=True)
    last_message_at = Column(DateTime, nullable=True)
    last_message_sender_id = Column(String, nullable=True)
    last_message_kind = Column(String, nullable=True)
    last_message_attachment_url = Column(String, nullable=True)
    last_message_attachment_type = Column(String, nullable=True)
    last_message_attachment_name = Column(String, nullable=True)
    unread_count = Column(Integer, default=0, nullable=False)
    pinned_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    user = relationship("User", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("user_id", "conversation_type", "conversation_id", name="uq_user_conv_pref"),
    )
