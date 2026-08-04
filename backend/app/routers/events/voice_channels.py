"""Events voice channel linking router."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.event import Event
from ...models.user import User
from ...models.voice_channel import VoiceChannel
from ...services.events import (
    link_voice_channel,
    unlink_voice_channel,
)
from ...services.events.notification_service import notify_event_updated
from ..events.deps import require_event_visibility, get_event_for_modification

router = APIRouter()


class VoiceChannelLinkRequest(BaseModel):
    voice_channel_id: str


class EventResponse(BaseModel):
    id: str
    room_id: str
    created_by: str
    title: str
    description: str
    status: str
    starts_at: str
    ends_at: str
    location_type: str
    location_name: str
    location_url: str
    voice_channel_id: str
    max_attendees: int
    require_approval: bool
    created_at: str
    updated_at: str
    cancelled_at: str
    cancelled_by: str
    creator: dict
    voice_channel: dict
    rsvp_counts: dict
    my_rsvp: str
    reminder_time: str

    class Config:
        from_attributes = True


def _event_to_response(event: Event, user_id: str) -> EventResponse:
    """Convert Event model to response schema."""
    return EventResponse(
        id=event.id,
        room_id=event.room_id,
        created_by=event.created_by,
        title=event.title,
        description=event.description,
        status=event.status.value if hasattr(event.status, 'value') else str(event.status),
        starts_at=event.starts_at.isoformat() if event.starts_at else None,
        ends_at=event.ends_at.isoformat() if event.ends_at else None,
        location_type=event.location_type.value if hasattr(event.location_type, 'value') else str(event.location_type),
        location_name=event.location_name,
        location_url=event.location_url,
        voice_channel_id=event.voice_channel_id,
        max_attendees=event.max_attendees,
        require_approval=event.require_approval,
        created_at=event.created_at.isoformat() if event.created_at else None,
        updated_at=event.updated_at.isoformat() if event.updated_at else None,
        cancelled_at=event.cancelled_at.isoformat() if event.cancelled_at else None,
        cancelled_by=event.cancelled_by,
        creator={
            "id": event.creator.id,
            "name": event.creator.name,
            "email": event.creator.email,
        } if event.creator else None,
        voice_channel={
            "id": event.voice_channel.id,
            "name": event.voice_channel.name,
        } if event.voice_channel else None,
        rsvp_counts=getattr(event, "_rsvp_counts", {}),
        my_rsvp=getattr(event, "_my_rsvp", None),
        reminder_time=getattr(event, "_reminder_time", None),
    )


@router.post("", response_model=EventResponse)
async def link_voice_channel_endpoint(
    event_id: str,
    link_data: VoiceChannelLinkRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _visibility: bool = Depends(require_event_visibility),
    event: Event = Depends(get_event_for_modification),
):
    """Link an existing voice channel to an event."""
    # Verify voice channel exists and is in same room
    vc_result = await db.execute(
        select(VoiceChannel).where(
            and_(VoiceChannel.id == link_data.voice_channel_id, VoiceChannel.room_id == event.room_id)
        )
    )
    voice_channel = vc_result.scalar_one_or_none()
    if not voice_channel:
        raise HTTPException(status_code=404, detail="Voice channel not found in this room")

    event.location_name = voice_channel.name
    event = await link_voice_channel(db, event, link_data.voice_channel_id)

    await notify_event_updated(db, event, event.room_id)

    return _event_to_response(event, current_user.id)


@router.delete("", response_model=EventResponse)
async def unlink_voice_channel_endpoint(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _visibility: bool = Depends(require_event_visibility),
    event: Event = Depends(get_event_for_modification),
):
    """Unlink voice channel from event."""
    event = await unlink_voice_channel(db, event)

    await notify_event_updated(db, event, event.room_id)

    return _event_to_response(event, current_user.id)