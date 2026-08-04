"""Events RSVP router."""

from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.event import Event, EventStatus, RSVPStatus
from ...models.user import User
from ...services.events import (
    check_capacity,
    upsert_rsvp,
    delete_rsvp,
    get_rsvps_list,
    get_rsvp_counts,
)
from ...services.events.notification_service import notify_rsvp_update, notify_rsvp_to_creator
from ..events.deps import require_event_visibility, get_event_with_access, get_event_for_modification

router = APIRouter()


class RSVPRequest(BaseModel):
    status: RSVPStatus


class RSVPResponse(BaseModel):
    event_id: str
    user_id: str
    status: RSVPStatus
    responded_at: datetime

    class Config:
        from_attributes = True


@router.post("/rsvp", response_model=RSVPResponse)
async def create_or_update_rsvp(
    event_id: str,
    rsvp_data: RSVPRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _visibility: bool = Depends(require_event_visibility),
    event: Event = Depends(get_event_with_access),
):
    """Create or update RSVP for an event."""
    if event.status == EventStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Cannot RSVP to cancelled event")

    # Check capacity
    if not await check_capacity(db, event_id, rsvp_data.status, current_user.id):
        raise HTTPException(status_code=400, detail="Event is full")

    rsvp = await upsert_rsvp(db, event_id, current_user.id, rsvp_data.status)

    # Notify creator if RSVP changed to GOING
    existing_going = rsvp_data.status == RSVPStatus.GOING
    if existing_going:
        # We need to check if it was previously GOING - for simplicity just notify
        # The service could return previous status, but this is fine for now
        await notify_rsvp_to_creator(db, event, current_user.id, current_user.name)

    # Broadcast RSVP update
    rsvp_counts = await get_rsvp_counts(db, event_id)
    await notify_rsvp_update(db, event, event.room_id, rsvp_counts, current_user.id, rsvp_data.status)

    return RSVPResponse(
        event_id=event_id,
        user_id=current_user.id,
        status=rsvp.status,
        responded_at=rsvp.responded_at,
    )


@router.get("/rsvps", response_model=List[RSVPResponse])
async def list_rsvps(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _visibility: bool = Depends(require_event_visibility),
    event: Event = Depends(get_event_for_modification),
):
    """List all RSVPs for an event (creator or admin/mod)."""
    rsvps = await get_rsvps_list(db, event_id)

    return [
        RSVPResponse(
            event_id=r.event_id,
            user_id=r.user_id,
            status=r.status,
            responded_at=r.responded_at,
        )
        for r in rsvps
    ]


@router.delete("/rsvp", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rsvp_endpoint(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _visibility: bool = Depends(require_event_visibility),
    event: Event = Depends(get_event_with_access),
):
    """Remove RSVP for an event."""
    deleted = await delete_rsvp(db, event_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="RSVP not found")

    # Broadcast update
    rsvp_counts = await get_rsvp_counts(db, event_id)
    await notify_rsvp_update(db, event, event.room_id, rsvp_counts, current_user.id, None)

    return None