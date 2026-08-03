import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer, Boolean, Enum as SQLEnum, UniqueConstraint, Index
from sqlalchemy.orm import relationship

from ..database import Base
import enum


class EventStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class EventLocationType(str, enum.Enum):
    PHYSICAL = "physical"      # "Sala Común", "Gran Comedor"
    VOICE_CHANNEL = "voice_channel"  # Auto-create or link to existing
    EXTERNAL_LINK = "external_link"  # Zoom, Discord, etc.
    TEXT_ONLY = "text_only"    # Solo chat en el grupo


class RSVPStatus(str, enum.Enum):
    GOING = "going"
    MAYBE = "maybe"
    NOT_GOING = "not_going"


class ReminderTime(str, enum.Enum):
    AT_TIME = "at_time"
    MINUTES_15 = "15min"
    HOUR_1 = "1h"
    HOURS_3 = "3h"
    DAY_1 = "1d"
    DAYS_3 = "3d"
    WEEK_1 = "1w"


class Event(Base):
    __tablename__ = "events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    room_id = Column(String, ForeignKey("chat_rooms.id"), nullable=False, index=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(SQLEnum(EventStatus), default=EventStatus.PUBLISHED, nullable=False)

    # Time
    starts_at = Column(DateTime, nullable=False, index=True)
    ends_at = Column(DateTime, nullable=True)

    # Location
    location_type = Column(SQLEnum(EventLocationType), default=EventLocationType.TEXT_ONLY, nullable=False)
    location_name = Column(String, nullable=True)          # "Sala Común", "Voice #general"
    location_url = Column(String, nullable=True)           # External link if EXTERNAL_LINK
    voice_channel_id = Column(String, ForeignKey("voice_channels.id"), nullable=True)  # Linked voice channel

    # Settings
    max_attendees = Column(Integer, nullable=True)         # None = unlimited
    require_approval = Column(Boolean, default=False, nullable=False)  # For RSVP

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    cancelled_at = Column(DateTime, nullable=True)
    cancelled_by = Column(String, ForeignKey("users.id"), nullable=True)

    # Relationships
    room = relationship("ChatRoom", lazy="selectin", foreign_keys=[room_id])
    creator = relationship("User", lazy="selectin", foreign_keys=[created_by])
    canceller = relationship("User", lazy="selectin", foreign_keys=[cancelled_by])
    voice_channel = relationship("VoiceChannel", lazy="selectin", foreign_keys=[voice_channel_id])
    rsvps = relationship("EventRSVP", back_populates="event", cascade="all, delete-orphan", lazy="selectin")
    reminders = relationship("EventReminder", back_populates="event", cascade="all, delete-orphan", lazy="selectin")


class EventRSVP(Base):
    __tablename__ = "event_rsvps"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id = Column(String, ForeignKey("events.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(SQLEnum(RSVPStatus), default=RSVPStatus.MAYBE, nullable=False)
    responded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    event = relationship("Event", back_populates="rsvps", lazy="selectin")
    user = relationship("User", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("event_id", "user_id", name="uq_event_user_rsvp"),
    )


class EventReminder(Base):
    __tablename__ = "event_reminders"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id = Column(String, ForeignKey("events.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    reminder_time = Column(SQLEnum(ReminderTime), default=ReminderTime.HOUR_1, nullable=False)
    sent = Column(Boolean, default=False, nullable=False)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    event = relationship("Event", back_populates="reminders", lazy="selectin")
    user = relationship("User", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("event_id", "user_id", "reminder_time", name="uq_event_user_reminder"),
    )


class EventVisibilitySettings(Base):
    """Global feature flag for events (admin-controlled in /settings)"""
    __tablename__ = "event_visibility_settings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    enabled = Column(Boolean, default=True, nullable=False)
    updated_by = Column(String, ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    updater = relationship("User", lazy="selectin")