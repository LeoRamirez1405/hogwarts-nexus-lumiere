"""Event business logic service."""

from datetime import datetime
from typing import List, Optional
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...models.chat_room import ChatRoom, ChatRoomMember
from ...models.event import (
    Event,
    EventLocationType,
    EventRSVP,
    EventReminder,
    EventStatus,
    EventVisibilitySettings,
    RSVPStatus,
)
from ...models.voice_channel import VoiceChannel


async def check_event_visibility(db: AsyncSession) -> bool:
    """Check if events feature is globally enabled."""
    result = await db.execute(select(EventVisibilitySettings).limit(1))
    settings = result.scalar_one_or_none()
    return settings.enabled if settings else True


async def check_room_admin_or_mod(db: AsyncSession, room_id: str, user_id: str) -> bool:
    """Check if user is admin or moderator of the room."""
    result = await db.execute(
        select(ChatRoomMember).where(
            and_(
                ChatRoomMember.room_id == room_id,
                ChatRoomMember.user_id == user_id,
                ChatRoomMember.role.in_(["admin", "moderator", "owner"]),
            )
        )
    )
    return result.scalar_one_or_none() is not None


async def check_room_member(db: AsyncSession, room_id: str, user_id: str) -> bool:
    """Check if user is a member of the room."""
    result = await db.execute(
        select(ChatRoomMember).where(
            and_(
                ChatRoomMember.room_id == room_id,
                ChatRoomMember.user_id == user_id,
            )
        )
    )
    return result.scalar_one_or_none() is not None


async def get_event_with_counts(
    db: AsyncSession, event_id: str, user_id: str
) -> Optional[Event]:
    """Get event with RSVP counts and user's RSVP."""
    result = await db.execute(
        select(Event)
        .options(
            selectinload(Event.creator),
            selectinload(Event.voice_channel),
            selectinload(Event.rsvps),
        )
        .where(Event.id == event_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        return None

    rsvp_counts_result = await db.execute(
        select(EventRSVP.status, func.count(EventRSVP.id))
        .where(EventRSVP.event_id == event_id)
        .group_by(EventRSVP.status)
    )
    event._rsvp_counts = {status.value: count for status, count in rsvp_counts_result.all()}

    my_rsvp_result = await db.execute(
        select(EventRSVP).where(
            and_(EventRSVP.event_id == event_id, EventRSVP.user_id == user_id)
        )
    )
    my_rsvp = my_rsvp_result.scalar_one_or_none()
    event._my_rsvp = my_rsvp.status if my_rsvp else None

    reminder_result = await db.execute(
        select(EventReminder).where(
            and_(EventReminder.event_id == event_id, EventReminder.user_id == user_id)
        )
    )
    reminder = reminder_result.scalar_one_or_none()
    event._reminder_time = reminder.reminder_time if reminder else None

    return event


async def create_event(
    db: AsyncSession,
    room_id: str,
    created_by: str,
    title: str,
    description: Optional[str],
    starts_at: datetime,
    ends_at: Optional[datetime],
    location_type: EventLocationType,
    location_name: Optional[str],
    location_url: Optional[str],
    create_voice_channel: bool,
    voice_channel_name: Optional[str],
    max_attendees: Optional[int],
    require_approval: bool,
) -> Event:
    """Create a new event with optional voice channel."""
    room_result = await db.execute(select(ChatRoom).where(ChatRoom.id == room_id))
    room = room_result.scalar_one_or_none()
    if not room:
        raise ValueError("Room not found")

    if ends_at and ends_at <= starts_at:
        raise ValueError("End time must be after start time")

    if starts_at < datetime.utcnow():
        raise ValueError("Start time cannot be in the past")

    voice_channel_id = None
    if create_voice_channel and location_type == EventLocationType.VOICE_CHANNEL:
        vc_name = voice_channel_name or f"🎉 {title}"
        voice_channel = VoiceChannel(
            room_id=room_id,
            name=vc_name,
            description=f"Canal de voz para el evento: {title}",
            created_by=created_by,
        )
        db.add(voice_channel)
        await db.flush()
        voice_channel_id = voice_channel.id

    event = Event(
        room_id=room_id,
        created_by=created_by,
        title=title,
        description=description,
        starts_at=starts_at,
        ends_at=ends_at,
        location_type=location_type,
        location_name=location_name,
        location_url=location_url,
        voice_channel_id=voice_channel_id,
        max_attendees=max_attendees,
        require_approval=require_approval,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event, ["creator", "voice_channel"])
    return event


async def update_event(
    db: AsyncSession,
    event: Event,
    update_data: dict,
) -> Event:
    """Update event fields."""
    new_starts = update_data.get("starts_at") or event.starts_at
    new_ends = update_data.get("ends_at") or event.ends_at
    if new_ends and new_ends <= new_starts:
        raise ValueError("End time must be after start time")

    for field, value in update_data.items():
        setattr(event, field, value)
    event.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(event, ["creator", "voice_channel"])
    return event


async def cancel_event(db: AsyncSession, event: Event, cancelled_by: str) -> Event:
    """Soft delete - mark event as cancelled."""
    event.status = EventStatus.CANCELLED
    event.cancelled_at = datetime.utcnow()
    event.cancelled_by = cancelled_by
    await db.commit()
    return event


async def get_events_list(
    db: AsyncSession,
    room_id: str,
    status_filter: Optional[EventStatus],
    upcoming_only: bool,
    limit: int,
    offset: int,
    user_id: str,
) -> tuple[List[Event], bool]:
    """Get paginated list of events with RSVP data."""
    query = (
        select(Event)
        .options(selectinload(Event.creator), selectinload(Event.voice_channel))
        .where(Event.room_id == room_id)
    )

    if status_filter:
        query = query.where(Event.status == status_filter)
    elif upcoming_only:
        query = query.where(Event.starts_at >= datetime.utcnow())

    if status_filter != EventStatus.CANCELLED:
        query = query.where(Event.status != EventStatus.CANCELLED)

    query = query.order_by(Event.starts_at.asc()).offset(offset).limit(limit + 1)

    result = await db.execute(query)
    events = result.scalars().all()

    has_more = len(events) > limit
    events = events[:limit]

    if events:
        event_ids = [e.id for e in events]
        rsvp_counts_result = await db.execute(
            select(EventRSVP.event_id, EventRSVP.status, func.count(EventRSVP.id))
            .where(EventRSVP.event_id.in_(event_ids))
            .group_by(EventRSVP.event_id, EventRSVP.status)
        )
        rsvp_counts_map = {}
        for event_id, status, count in rsvp_counts_result.all():
            if event_id not in rsvp_counts_map:
                rsvp_counts_map[event_id] = {}
            rsvp_counts_map[event_id][status.value] = count

        my_rsvp_result = await db.execute(
            select(EventRSVP).where(
                and_(EventRSVP.event_id.in_(event_ids), EventRSVP.user_id == user_id)
            )
        )
        my_rsvp_map = {r.event_id: r.status for r in my_rsvp_result.scalars().all()}

        reminder_result = await db.execute(
            select(EventReminder).where(
                and_(EventReminder.event_id.in_(event_ids), EventReminder.user_id == user_id)
            )
        )
        reminder_map = {r.event_id: r.reminder_time for r in reminder_result.scalars().all()}

        for event in events:
            event._rsvp_counts = rsvp_counts_map.get(event.id, {})
            event._my_rsvp = my_rsvp_map.get(event.id)
            event._reminder_time = reminder_map.get(event.id)

    return events, has_more


async def get_attending_users(db: AsyncSession, event_id: str) -> List[str]:
    """Get list of user IDs attending an event (GOING RSVP)."""
    result = await db.execute(
        select(EventRSVP.user_id).where(
            and_(EventRSVP.event_id == event_id, EventRSVP.status == RSVPStatus.GOING)
        )
    )
    return [row[0] for row in result.all()]


async def link_voice_channel(
    db: AsyncSession,
    event: Event,
    voice_channel_id: str,
) -> Event:
    """Link an existing voice channel to an event."""
    event.voice_channel_id = voice_channel_id
    event.location_type = EventLocationType.VOICE_CHANNEL
    # Location name will be set by router after fetching voice channel
    event.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(event, ["creator", "voice_channel"])
    return event


async def unlink_voice_channel(db: AsyncSession, event: Event) -> Event:
    """Unlink voice channel from event."""
    event.voice_channel_id = None
    event.location_type = EventLocationType.TEXT_ONLY
    event.location_name = None
    event.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(event, ["creator", "voice_channel"])
    return event


async def get_or_create_visibility_settings(db: AsyncSession, enabled: bool = True, updated_by: str = None) -> EventVisibilitySettings:
    """Get or create global visibility settings."""
    result = await db.execute(select(EventVisibilitySettings).limit(1))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = EventVisibilitySettings(enabled=enabled, updated_by=updated_by)
        db.add(settings)
    else:
        settings.enabled = enabled
        settings.updated_by = updated_by
        settings.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(settings)
    return settings