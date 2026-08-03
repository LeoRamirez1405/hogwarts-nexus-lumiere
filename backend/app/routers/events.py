"""Group Events API Routes"""

import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..middleware.auth import get_current_user
from ..models.chat_room import ChatRoom, ChatRoomMember
from ..models.event import (
    Event,
    EventLocationType,
    EventReminder,
    EventRSVP,
    EventStatus,
    EventVisibilitySettings,
    ReminderTime,
    RSVPStatus,
)
from ..models.user import User
from ..models.voice_channel import VoiceChannel
from ..notifications_service import notify, N
from ..schemas.user import UserResponse
from ..ws_manager import manager


router = APIRouter(prefix="/events", tags=["events"])


# ============================================================
# Schemas
# ============================================================

class EventCreate(BaseModel):
    room_id: str
    title: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None
    starts_at: datetime
    ends_at: Optional[datetime] = None
    location_type: EventLocationType = EventLocationType.TEXT_ONLY
    location_name: Optional[str] = None
    location_url: Optional[str] = None
    create_voice_channel: bool = False  # If true, create voice channel for event
    voice_channel_name: Optional[str] = None
    max_attendees: Optional[int] = Field(None, ge=1)
    require_approval: bool = False


class EventUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    location_type: Optional[EventLocationType] = None
    location_name: Optional[str] = None
    location_url: Optional[str] = None
    max_attendees: Optional[int] = Field(None, ge=1)
    require_approval: bool = False
    status: Optional[EventStatus] = None


class EventResponse(BaseModel):
    id: str
    room_id: str
    created_by: str
    title: str
    description: Optional[str]
    status: EventStatus
    starts_at: datetime
    ends_at: Optional[datetime]
    location_type: EventLocationType
    location_name: Optional[str]
    location_url: Optional[str]
    voice_channel_id: Optional[str]
    max_attendees: Optional[int]
    require_approval: bool
    created_at: datetime
    updated_at: datetime
    cancelled_at: Optional[datetime]
    cancelled_by: Optional[str]
    creator: Optional[UserResponse] = None
    voice_channel: Optional[dict] = None
    rsvp_counts: dict = Field(default_factory=dict)
    my_rsvp: Optional[RSVPStatus] = None
    reminder_time: Optional[ReminderTime] = None

    class Config:
        from_attributes = True


class EventListResponse(BaseModel):
    events: List[EventResponse]
    has_more: bool


class RSVPRequest(BaseModel):
    status: RSVPStatus


class RSVPResponse(BaseModel):
    event_id: str
    user_id: str
    status: RSVPStatus
    responded_at: datetime


class ReminderSettingsRequest(BaseModel):
    reminder_time: ReminderTime


class ReminderSettingsResponse(BaseModel):
    event_id: str
    user_id: str
    reminder_time: ReminderTime


class VisibilitySettingsResponse(BaseModel):
    enabled: bool


class VoiceChannelLinkRequest(BaseModel):
    voice_channel_id: str


# ============================================================
# Helpers
# ============================================================

async def _check_room_admin_or_mod(db: AsyncSession, room_id: str, user_id: str) -> bool:
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


async def _check_room_member(db: AsyncSession, room_id: str, user_id: str) -> bool:
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


async def _check_event_visibility(db: AsyncSession) -> bool:
    """Check if events feature is globally enabled."""
    result = await db.execute(select(EventVisibilitySettings).limit(1))
    settings = result.scalar_one_or_none()
    return settings.enabled if settings else True


async def _get_event_with_counts(db: AsyncSession, event_id: str, user_id: str) -> Optional[Event]:
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

    # Get RSVP counts
    rsvp_counts_result = await db.execute(
        select(EventRSVP.status, func.count(EventRSVP.id))
        .where(EventRSVP.event_id == event_id)
        .group_by(EventRSVP.status)
    )
    rsvp_counts = {status.value: count for status, count in rsvp_counts_result.all()}

    # Get user's RSVP
    my_rsvp_result = await db.execute(
        select(EventRSVP).where(
            and_(EventRSVP.event_id == event_id, EventRSVP.user_id == user_id)
        )
    )
    my_rsvp = my_rsvp_result.scalar_one_or_none()

    # Get user's reminder setting
    reminder_result = await db.execute(
        select(EventReminder).where(
            and_(EventReminder.event_id == event_id, EventReminder.user_id == user_id)
        )
    )
    reminder = reminder_result.scalar_one_or_none()

    # Attach computed fields
    event._rsvp_counts = rsvp_counts
    event._my_rsvp = my_rsvp.status if my_rsvp else None
    event._reminder_time = reminder.reminder_time if reminder else None

    return event


def _event_to_response(event: Event, user_id: str) -> EventResponse:
    """Convert Event model to response schema."""
    return EventResponse(
        id=event.id,
        room_id=event.room_id,
        created_by=event.created_by,
        title=event.title,
        description=event.description,
        status=event.status,
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        location_type=event.location_type,
        location_name=event.location_name,
        location_url=event.location_url,
        voice_channel_id=event.voice_channel_id,
        max_attendees=event.max_attendees,
        require_approval=event.require_approval,
        created_at=event.created_at,
        updated_at=event.updated_at,
        cancelled_at=event.cancelled_at,
        cancelled_by=event.cancelled_by,
        creator=event.creator,
        voice_channel={
            "id": event.voice_channel.id,
            "name": event.voice_channel.name,
        } if event.voice_channel else None,
        rsvp_counts=getattr(event, "_rsvp_counts", {}),
        my_rsvp=getattr(event, "_my_rsvp", None),
        reminder_time=getattr(event, "_reminder_time", None),
    )


# ============================================================
# Visibility Settings (Admin only)
# ============================================================

@router.get("/visibility", response_model=VisibilitySettingsResponse)
async def get_event_visibility(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get global events visibility setting (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.execute(select(EventVisibilitySettings).limit(1))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = EventVisibilitySettings(enabled=True)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)

    return VisibilitySettingsResponse(enabled=settings.enabled)


@router.patch("/visibility", response_model=VisibilitySettingsResponse)
async def update_event_visibility(
    enabled: bool,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update global events visibility setting (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.execute(select(EventVisibilitySettings).limit(1))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = EventVisibilitySettings(enabled=enabled, updated_by=current_user.id)
        db.add(settings)
    else:
        settings.enabled = enabled
        settings.updated_by = current_user.id
        settings.updated_at = datetime.utcnow()

    await db.commit()
    return VisibilitySettingsResponse(enabled=settings.enabled)


# ============================================================
# Event CRUD
# ============================================================

@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    event_data: EventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new event in a room."""
    # Check feature visibility
    if not await _check_event_visibility(db):
        raise HTTPException(status_code=404, detail="Events feature is disabled")

    # Check room exists
    room_result = await db.execute(select(ChatRoom).where(ChatRoom.id == event_data.room_id))
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    # Check permissions: admin or moderator
    if not await _check_room_admin_or_mod(db, event_data.room_id, current_user.id):
        raise HTTPException(status_code=403, detail="Only admins and moderators can create events")

    # Validate dates
    if event_data.ends_at and event_data.ends_at <= event_data.starts_at:
        raise HTTPException(status_code=400, detail="End time must be after start time")

    if event_data.starts_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Start time cannot be in the past")

    # Handle voice channel creation
    voice_channel_id = None
    if event_data.create_voice_channel and event_data.location_type == EventLocationType.VOICE_CHANNEL:
        vc_name = event_data.voice_channel_name or f"🎉 {event_data.title}"
        voice_channel = VoiceChannel(
            room_id=event_data.room_id,
            name=vc_name,
            description=f"Canal de voz para el evento: {event_data.title}",
            created_by=current_user.id,
        )
        db.add(voice_channel)
        await db.flush()
        voice_channel_id = voice_channel.id

    # Create event
    event = Event(
        room_id=event_data.room_id,
        created_by=current_user.id,
        title=event_data.title,
        description=event_data.description,
        starts_at=event_data.starts_at,
        ends_at=event_data.ends_at,
        location_type=event_data.location_type,
        location_name=event_data.location_name,
        location_url=event_data.location_url,
        voice_channel_id=voice_channel_id,
        max_attendees=event_data.max_attendees,
        require_approval=event_data.require_approval,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    # Load relationships for response
    await db.refresh(event, ["creator", "voice_channel"])

    # Notify room members
    member_result = await db.execute(
        select(ChatRoomMember.user_id).where(ChatRoomMember.room_id == event_data.room_id)
    )
    for (member_id,) in member_result.all():
        if member_id != current_user.id:
            await notify(
                db,
                user_id=member_id,
                type=N.GROUP_EVENT,
                title=f"Nuevo evento en {room.name}",
                body=f"{current_user.name} creó: {event_data.title}",
                related_id=f"event:{event.id}",
                actor_id=current_user.id,
            )

    # Broadcast via WS
    payload = {
        "t": "event_created",
        "c": event_data.room_id,
        "e": _event_to_response(event, current_user.id).model_dump(mode="json"),
    }
    await manager.broadcast_to_room(event_data.room_id, payload)

    return _event_to_response(event, current_user.id)


@router.get("", response_model=EventListResponse)
async def list_events(
    room_id: str = Query(..., description="Room ID"),
    status_filter: Optional[EventStatus] = Query(None, alias="status"),
    upcoming_only: bool = Query(True),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List events for a room."""
    # Check feature visibility
    if not await _check_event_visibility(db):
        raise HTTPException(status_code=404, detail="Events feature is disabled")

    # Check room membership
    if not await _check_room_member(db, room_id, current_user.id):
        raise HTTPException(status_code=403, detail="Not a member of this room")

    # Build query
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

    # Get RSVP counts and user RSVPs for all events
    event_ids = [e.id for e in events]
    if event_ids:
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
                and_(EventRSVP.event_id.in_(event_ids), EventRSVP.user_id == current_user.id)
            )
        )
        my_rsvp_map = {r.event_id: r.status for r in my_rsvp_result.scalars().all()}

        reminder_result = await db.execute(
            select(EventReminder).where(
                and_(EventReminder.event_id.in_(event_ids), EventReminder.user_id == current_user.id)
            )
        )
        reminder_map = {r.event_id: r.reminder_time for r in reminder_result.scalars().all()}
    else:
        rsvp_counts_map = {}
        my_rsvp_map = {}
        reminder_map = {}

    responses = []
    for event in events:
        event._rsvp_counts = rsvp_counts_map.get(event.id, {})
        event._my_rsvp = my_rsvp_map.get(event.id)
        event._reminder_time = reminder_map.get(event.id)
        responses.append(_event_to_response(event, current_user.id))

    return EventListResponse(events=responses, has_more=has_more)


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single event with details."""
    if not await _check_event_visibility(db):
        raise HTTPException(status_code=404, detail="Events feature is disabled")

    event = await _get_event_with_counts(db, event_id, current_user.id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Check room membership
    if not await _check_room_member(db, event.room_id, current_user.id):
        raise HTTPException(status_code=403, detail="Not a member of this room")

    return _event_to_response(event, current_user.id)


@router.patch("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: str,
    event_data: EventUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an event (creator or admin/mod)."""
    if not await _check_event_visibility(db):
        raise HTTPException(status_code=404, detail="Events feature is disabled")

    result = await db.execute(
        select(Event).options(selectinload(Event.creator), selectinload(Event.voice_channel)).where(Event.id == event_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Check permissions: creator or admin/mod
    is_creator = event.created_by == current_user.id
    is_admin_mod = await _check_room_admin_or_mod(db, event.room_id, current_user.id)
    if not (is_creator or is_admin_mod):
        raise HTTPException(status_code=403, detail="Only creator or admin/mod can edit this event")

    # Validate dates
    new_starts = event_data.starts_at or event.starts_at
    new_ends = event_data.ends_at or event.ends_at
    if new_ends and new_ends <= new_starts:
        raise HTTPException(status_code=400, detail="End time must be after start time")

    # Apply updates
    update_data = event_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(event, field, value)

    event.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(event, ["creator", "voice_channel"])

    # Broadcast update
    payload = {
        "t": "event_updated",
        "c": event.room_id,
        "e": _event_to_response(event, current_user.id).model_dump(mode="json"),
    }
    await manager.broadcast_to_room(event.room_id, payload)

    return _event_to_response(event, current_user.id)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete/cancel an event (creator or admin/mod)."""
    if not await _check_event_visibility(db):
        raise HTTPException(status_code=404, detail="Events feature is disabled")

    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Check permissions
    is_creator = event.created_by == current_user.id
    is_admin_mod = await _check_room_admin_or_mod(db, event.room_id, current_user.id)
    if not (is_creator or is_admin_mod):
        raise HTTPException(status_code=403, detail="Only creator or admin/mod can delete this event")

    # Soft delete - mark as cancelled
    event.status = EventStatus.CANCELLED
    event.cancelled_at = datetime.utcnow()
    event.cancelled_by = current_user.id
    await db.commit()

    # Notify attendees
    rsvp_result = await db.execute(
        select(EventRSVP.user_id).where(
            and_(EventRSVP.event_id == event_id, EventRSVP.status == RSVPStatus.GOING)
        )
    )
    for (attendee_id,) in rsvp_result.all():
        if attendee_id != current_user.id:
            await notify(
                db,
                user_id=attendee_id,
                type=N.GROUP_EVENT,
                title="Evento cancelado",
                body=f"El evento '{event.title}' ha sido cancelado",
                related_id=f"event:{event_id}",
                actor_id=current_user.id,
            )

    # Broadcast
    payload = {
        "t": "event_cancelled",
        "c": event.room_id,
        "e": {"id": event_id, "status": "cancelled"},
    }
    await manager.broadcast_to_room(event.room_id, payload)


# ============================================================
# RSVP
# ============================================================

@router.post("/{event_id}/rsvp", response_model=RSVPResponse)
async def create_or_update_rsvp(
    event_id: str,
    rsvp_data: RSVPRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or update RSVP for an event."""
    if not await _check_event_visibility(db):
        raise HTTPException(status_code=404, detail="Events feature is disabled")

    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.status == EventStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Cannot RSVP to cancelled event")

    # Check room membership
    if not await _check_room_member(db, event.room_id, current_user.id):
        raise HTTPException(status_code=403, detail="Not a member of this room")

    # Check capacity
    if event.max_attendees and rsvp_data.status == RSVPStatus.GOING:
        going_count_result = await db.execute(
            select(func.count(EventRSVP.id)).where(
                and_(EventRSVP.event_id == event_id, EventRSVP.status == RSVPStatus.GOING)
            )
        )
        going_count = going_count_result.scalar() or 0

        # Check if user already has GOING RSVP
        existing_result = await db.execute(
            select(EventRSVP).where(
                and_(EventRSVP.event_id == event_id, EventRSVP.user_id == current_user.id)
            )
        )
        existing = existing_result.scalar_one_or_none()
        if not existing or existing.status != RSVPStatus.GOING:
            if going_count >= event.max_attendees:
                raise HTTPException(status_code=400, detail="Event is full")

    # Upsert RSVP
    existing_result = await db.execute(
        select(EventRSVP).where(
            and_(EventRSVP.event_id == event_id, EventRSVP.user_id == current_user.id)
        )
    )
    existing = existing_result.scalar_one_or_none()

    if existing:
        old_status = existing.status
        existing.status = rsvp_data.status
        existing.updated_at = datetime.utcnow()
        existing.responded_at = datetime.utcnow()
    else:
        existing = EventRSVP(
            event_id=event_id,
            user_id=current_user.id,
            status=rsvp_data.status,
        )
        db.add(existing)

    await db.commit()
    await db.refresh(existing)

    # Notify creator if RSVP changed to GOING
    if rsvp_data.status == RSVPStatus.GOING and existing.status != RSVPStatus.GOING:
        if event.created_by != current_user.id:
            await notify(
                db,
                user_id=event.created_by,
                type=N.GROUP_EVENT,
                title="Nueva confirmación",
                body=f"{current_user.name} va a tu evento '{event.title}'",
                related_id=f"event:{event_id}",
                actor_id=current_user.id,
            )

    # Broadcast RSVP update
    rsvp_counts_result = await db.execute(
        select(EventRSVP.status, func.count(EventRSVP.id))
        .where(EventRSVP.event_id == event_id)
        .group_by(EventRSVP.status)
    )
    rsvp_counts = {status.value: count for status, count in rsvp_counts_result.all()}

    payload = {
        "t": "event_rsvp_updated",
        "c": event.room_id,
        "e": {"id": event_id, "rsvp_counts": rsvp_counts},
        "u": {"id": current_user.id, "status": rsvp_data.status.value},
    }
    await manager.broadcast_to_room(event.room_id, payload)

    return RSVPResponse(
        event_id=event_id,
        user_id=current_user.id,
        status=existing.status,
        responded_at=existing.responded_at,
    )


@router.get("/{event_id}/rsvps", response_model=List[RSVPResponse])
async def list_rsvps(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all RSVPs for an event (creator or admin/mod)."""
    if not await _check_event_visibility(db):
        raise HTTPException(status_code=404, detail="Events feature is disabled")

    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Check permissions: creator or admin/mod
    is_creator = event.created_by == current_user.id
    is_admin_mod = await _check_room_admin_or_mod(db, event.room_id, current_user.id)
    if not (is_creator or is_admin_mod):
        raise HTTPException(status_code=403, detail="Only creator or admin/mod can view RSVPs")

    result = await db.execute(
        select(EventRSVP)
        .options(selectinload(EventRSVP.user))
        .where(EventRSVP.event_id == event_id)
        .order_by(EventRSVP.responded_at.desc())
    )
    rsvps = result.scalars().all()

    return [
        RSVPResponse(
            event_id=r.event_id,
            user_id=r.user_id,
            status=r.status,
            responded_at=r.responded_at,
        )
        for r in rsvps
    ]


@router.delete("/{event_id}/rsvp", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rsvp(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove RSVP for an event."""
    if not await _check_event_visibility(db):
        raise HTTPException(status_code=404, detail="Events feature is disabled")

    result = await db.execute(
        select(EventRSVP).where(
            and_(EventRSVP.event_id == event_id, EventRSVP.user_id == current_user.id)
        )
    )
    rsvp = result.scalar_one_or_none()
    if not rsvp:
        raise HTTPException(status_code=404, detail="RSVP not found")

    await db.delete(rsvp)
    await db.commit()

    # Broadcast update
    rsvp_counts_result = await db.execute(
        select(EventRSVP.status, func.count(EventRSVP.id))
        .where(EventRSVP.event_id == event_id)
        .group_by(EventRSVP.status)
    )
    rsvp_counts = {status.value: count for status, count in rsvp_counts_result.all()}

    payload = {
        "t": "event_rsvp_updated",
        "c": rsvp.event_id,  # Need room_id - get from event
        "e": {"id": event_id, "rsvp_counts": rsvp_counts},
        "u": {"id": current_user.id, "status": None},
    }
    # Get room_id from event
    event_result = await db.execute(select(Event.room_id).where(Event.id == event_id))
    room_id = event_result.scalar_one()
    payload["c"] = room_id
    await manager.broadcast_to_room(room_id, payload)


# ============================================================
# Reminders
# ============================================================

@router.get("/{event_id}/reminder", response_model=ReminderSettingsResponse)
async def get_reminder_setting(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user's reminder setting for an event."""
    if not await _check_event_visibility(db):
        raise HTTPException(status_code=404, detail="Events feature is disabled")

    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if not await _check_room_member(db, event.room_id, current_user.id):
        raise HTTPException(status_code=403, detail="Not a member of this room")

    result = await db.execute(
        select(EventReminder).where(
            and_(EventReminder.event_id == event_id, EventReminder.user_id == current_user.id)
        )
    )
    reminder = result.scalar_one_or_none()

    return ReminderSettingsResponse(
        event_id=event_id,
        user_id=current_user.id,
        reminder_time=reminder.reminder_time if reminder else ReminderTime.HOUR_1,
    )


@router.patch("/{event_id}/reminder", response_model=ReminderSettingsResponse)
async def update_reminder_setting(
    event_id: str,
    reminder_data: ReminderSettingsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user's reminder setting for an event."""
    if not await _check_event_visibility(db):
        raise HTTPException(status_code=404, detail="Events feature is disabled")

    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if not await _check_room_member(db, event.room_id, current_user.id):
        raise HTTPException(status_code=403, detail="Not a member of this room")

    # Upsert reminder setting
    result = await db.execute(
        select(EventReminder).where(
            and_(EventReminder.event_id == event_id, EventReminder.user_id == current_user.id)
        )
    )
    reminder = result.scalar_one_or_none()

    if reminder:
        reminder.reminder_time = reminder_data.reminder_time
    else:
        reminder = EventReminder(
            event_id=event_id,
            user_id=current_user.id,
            reminder_time=reminder_data.reminder_time,
        )
        db.add(reminder)

    await db.commit()

    return ReminderSettingsResponse(
        event_id=event_id,
        user_id=current_user.id,
        reminder_time=reminder_data.reminder_time,
    )


# ============================================================
# Voice Channel Linking
# ============================================================

@router.post("/{event_id}/voice-channel", response_model=EventResponse)
async def link_voice_channel(
    event_id: str,
    link_data: VoiceChannelLinkRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Link an existing voice channel to an event."""
    if not await _check_event_visibility(db):
        raise HTTPException(status_code=404, detail="Events feature is disabled")

    result = await db.execute(
        select(Event).options(selectinload(Event.creator), selectinload(Event.voice_channel)).where(Event.id == event_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Check permissions
    is_creator = event.created_by == current_user.id
    is_admin_mod = await _check_room_admin_or_mod(db, event.room_id, current_user.id)
    if not (is_creator or is_admin_mod):
        raise HTTPException(status_code=403, detail="Only creator or admin/mod can link voice channel")

    # Verify voice channel exists and is in same room
    vc_result = await db.execute(
        select(VoiceChannel).where(
            and_(VoiceChannel.id == link_data.voice_channel_id, VoiceChannel.room_id == event.room_id)
        )
    )
    voice_channel = vc_result.scalar_one_or_none()
    if not voice_channel:
        raise HTTPException(status_code=404, detail="Voice channel not found in this room")

    event.voice_channel_id = link_data.voice_channel_id
    event.location_type = EventLocationType.VOICE_CHANNEL
    event.location_name = voice_channel.name
    event.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(event, ["creator", "voice_channel"])

    # Broadcast
    payload = {
        "t": "event_updated",
        "c": event.room_id,
        "e": _event_to_response(event, current_user.id).model_dump(mode="json"),
    }
    await manager.broadcast_to_room(event.room_id, payload)

    return _event_to_response(event, current_user.id)


@router.delete("/{event_id}/voice-channel", response_model=EventResponse)
async def unlink_voice_channel(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unlink voice channel from event."""
    if not await _check_event_visibility(db):
        raise HTTPException(status_code=404, detail="Events feature is disabled")

    result = await db.execute(
        select(Event).options(selectinload(Event.creator), selectinload(Event.voice_channel)).where(Event.id == event_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Check permissions
    is_creator = event.created_by == current_user.id
    is_admin_mod = await _check_room_admin_or_mod(db, event.room_id, current_user.id)
    if not (is_creator or is_admin_mod):
        raise HTTPException(status_code=403, detail="Only creator or admin/mod can unlink voice channel")

    event.voice_channel_id = None
    event.location_type = EventLocationType.TEXT_ONLY
    event.location_name = None
    event.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(event, ["creator", "voice_channel"])

    # Broadcast
    payload = {
        "t": "event_updated",
        "c": event.room_id,
        "e": _event_to_response(event, current_user.id).model_dump(mode="json"),
    }
    await manager.broadcast_to_room(event.room_id, payload)

    return _event_to_response(event, current_user.id)