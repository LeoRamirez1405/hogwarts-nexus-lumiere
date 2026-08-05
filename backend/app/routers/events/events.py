"""Events CRUD router."""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.chat_room import ChatRoom
from ...models.event import Event, EventLocationType, EventStatus, RSVPStatus, ReminderTime
from ...models.user import User
from ...schemas.user import UserResponse
from ...services.events import (
    check_room_admin_or_mod,
    check_room_member,
    create_event,
    update_event,
    cancel_event,
    get_events_list,
    get_event_with_counts,
    get_live_event,
)
from ...notifications_service import notify, N
from ..events.deps import require_event_visibility, require_room_member

router = APIRouter()


# Schemas

class EventCreate(BaseModel):
    room_id: str
    title: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None
    starts_at: datetime
    ends_at: datetime
    location_type: EventLocationType = EventLocationType.TEXT_ONLY
    location_name: Optional[str] = None
    location_url: Optional[str] = None
    create_voice_channel: bool = False
    voice_channel_name: Optional[str] = None
    max_attendees: Optional[int] = Field(None, ge=1)
    require_approval: bool = False

    @field_validator("starts_at", "ends_at")
    @classmethod
    def _to_naive_utc(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is None:
            return v
        if v.tzinfo is not None:
            v = v.astimezone(timezone.utc).replace(tzinfo=None)
        return v


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

    @field_validator("starts_at", "ends_at")
    @classmethod
    def _to_naive_utc(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is None:
            return v
        if v.tzinfo is not None:
            v = v.astimezone(timezone.utc).replace(tzinfo=None)
        return v


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
    in_progress: bool = False

    class Config:
        from_attributes = True


class EventListResponse(BaseModel):
    events: List[EventResponse]
    has_more: bool


def _event_to_response(event: Event, user_id: str) -> EventResponse:
    """Convert Event model to response schema."""
    now = datetime.utcnow()
    in_progress = (
        event.status == EventStatus.PUBLISHED
        and event.starts_at <= now
        and (event.ends_at is None or now < event.ends_at)
    )
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
        in_progress=in_progress,
    )


@router.post("/", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event_endpoint(
    event_data: EventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _visibility: bool = Depends(require_event_visibility),
):
    """Create a new event in a room."""
    # Check permissions for the specific room
    if not await check_room_admin_or_mod(db, event_data.room_id, current_user.id):
        raise HTTPException(status_code=403, detail="Only admins and moderators can create events")

    # Create event
    try:
        event = await create_event(
            db=db,
            room_id=event_data.room_id,
            created_by=current_user.id,
            title=event_data.title,
            description=event_data.description,
            starts_at=event_data.starts_at,
            ends_at=event_data.ends_at,
            location_type=event_data.location_type,
            location_name=event_data.location_name,
            location_url=event_data.location_url,
            create_voice_channel=event_data.create_voice_channel,
            voice_channel_name=event_data.voice_channel_name,
            max_attendees=event_data.max_attendees,
            require_approval=event_data.require_approval,
        )
    except ValueError as e:
        # "ya tiene un evento activo" is a conflict; the rest are bad input.
        detail = str(e)
        code = 409 if "evento activo" in detail else 400
        raise HTTPException(status_code=code, detail=detail)

    # Get room for notification
    room_result = await db.execute(select(ChatRoom).where(ChatRoom.id == event_data.room_id))
    room = room_result.scalar_one()

    # Notify room members
    from ...services.events import notify_event_created
    await notify_event_created(db, event, room, current_user.id)

    return _event_to_response(event, current_user.id)


@router.get("/", response_model=EventListResponse)
async def list_events(
    room_id: str = Query(..., description="Room ID"),
    status_filter: Optional[EventStatus] = Query(None, alias="status"),
    upcoming_only: bool = Query(True),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _visibility: bool = Depends(require_event_visibility),
    _member: bool = Depends(require_room_member),  # checks room_id from query
):
    """List events for a room."""
    events, has_more = await get_events_list(
        db=db,
        room_id=room_id,
        status_filter=status_filter,
        upcoming_only=upcoming_only,
        limit=limit,
        offset=offset,
        user_id=current_user.id,
    )

    return EventListResponse(
        events=[_event_to_response(e, current_user.id) for e in events],
        has_more=has_more,
    )


@router.get("/current", response_model=Optional[EventResponse])
async def get_current_event(
    room_id: str = Query(..., description="Room ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _visibility: bool = Depends(require_event_visibility),
    _member: bool = Depends(require_room_member),  # checks room_id from query
):
    """Get the room's single live event (upcoming or in progress), or null.

    Defined before ``/{event_id}`` so the literal path wins the route match.
    """
    live = await get_live_event(db, room_id)
    if not live:
        return None
    event = await get_event_with_counts(db, live.id, current_user.id)
    return _event_to_response(event, current_user.id)


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _visibility: bool = Depends(require_event_visibility),
):
    """Get a single event with details."""
    event = await get_event_with_counts(db, event_id, current_user.id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if not await check_room_member(db, event.room_id, current_user.id):
        raise HTTPException(status_code=403, detail="Not a member of this room")

    return _event_to_response(event, current_user.id)


@router.patch("/{event_id}", response_model=EventResponse)
async def update_event_endpoint(
    event_id: str,
    event_data: EventUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _visibility: bool = Depends(require_event_visibility),
):
    """Update an event (creator or admin/mod)."""
    event = await get_event_with_counts(db, event_id, current_user.id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    is_creator = event.created_by == current_user.id
    is_admin_mod = await check_room_admin_or_mod(db, event.room_id, current_user.id)
    if not (is_creator or is_admin_mod):
        raise HTTPException(status_code=403, detail="Only creator or admin/mod can edit this event")

    update_dict = event_data.model_dump(exclude_unset=True)
    event = await update_event(db, event, update_dict)

    from ...services.events import notify_event_updated
    await notify_event_updated(db, event, event.room_id)

    return _event_to_response(event, current_user.id)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _visibility: bool = Depends(require_event_visibility),
):
    """Delete/cancel an event (creator or admin/mod)."""
    event = await get_event_with_counts(db, event_id, current_user.id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    is_creator = event.created_by == current_user.id
    is_admin_mod = await check_room_admin_or_mod(db, event.room_id, current_user.id)
    if not (is_creator or is_admin_mod):
        raise HTTPException(status_code=403, detail="Only creator or admin/mod can delete this event")

    event = await cancel_event(db, event, current_user.id)

    from ...services.events import notify_event_cancelled, get_attending_users
    await notify_event_cancelled(db, event, current_user.id)

    # Notify attending users
    attending_users = await get_attending_users(db, event_id)
    for attendee_id in attending_users:
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

    return None