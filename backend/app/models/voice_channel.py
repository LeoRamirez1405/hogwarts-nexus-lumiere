import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship

from ..database import Base


class VoiceChannel(Base):
    __tablename__ = "voice_channels"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    room_id = Column(String, ForeignKey("chat_rooms.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    room = relationship("ChatRoom", lazy="selectin", foreign_keys=[room_id])
    creator = relationship("User", lazy="selectin", foreign_keys=[created_by])
    participants = relationship(
        "VoiceChannelParticipant",
        back_populates="channel",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class VoiceChannelParticipant(Base):
    __tablename__ = "voice_channel_participants"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    channel_id = Column(String, ForeignKey("voice_channels.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    joined_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    muted = Column(Boolean, default=False, nullable=False)
    deafened = Column(Boolean, default=False, nullable=False)
    video_enabled = Column(Boolean, default=False, nullable=False)
    screen_sharing = Column(Boolean, default=False, nullable=False)

    channel = relationship("VoiceChannel", back_populates="participants", lazy="selectin")
    user = relationship("User", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("channel_id", "user_id", name="uq_voice_channel_user"),
    )