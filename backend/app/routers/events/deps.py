"""Shared dependencies for events routers."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import Depends, HTTPException

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.chat_room import ChatRoom
from ...models.event import (
    Event,
)
from ...models.user import User
from ...services.events import (
    check_event_visibility,
    check_room_admin_or_mod,
    check_room_member,
    get_event_with_counts,
)


async def require_event_visibility(db: AsyncSession = Depends(get_db)) -> bool:
    """Dependency that checks if events feature is enabled."""
    enabled = await check_event_visibility(db)
    if not enabled:
        raise HTTPException(status_code=404, detail="Events feature is disabled")
    return True


async def get_event_or_404(
    event_id: str,
    db: AsyncSession = Depends(get_db),
) -> Event:
    """Get event by ID or raise 404."""
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
        raise HTTPException(status_code=404, detail="Event not found")
    return event


async def get_event_with_access(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    require_membership: bool = True,
) -> Event:
    """Get event and verify user has access (room membership)."""
    event = await get_event_with_counts(db, event_id, current_user.id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if require_membership and current_user.role != "admin":
        is_member = await check_room_member(db, event.room_id, current_user.id)
        if not is_member:
            raise HTTPException(status_code=403, detail="Not a member of this room")

    return event


async def get_event_for_modification(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Event:
    """Get event and verify user can modify it (creator or admin/mod)."""
    event = await get_event_with_access(event_id, current_user, db)
    is_creator = event.created_by == current_user.id
    is_admin_mod = current_user.role == "admin" or await check_room_admin_or_mod(
        db, event.room_id, current_user.id
    )
    if not (is_creator or is_admin_mod):
        raise HTTPException(
            status_code=403,
            detail="Only creator or admin/mod can modify this event",
        )
    return event


async def get_room_or_404(
    room_id: str,
    db: AsyncSession = Depends(get_db),
) -> ChatRoom:
    """Get room by ID or raise 404."""
    result = await db.execute(select(ChatRoom).where(ChatRoom.id == room_id))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


async def require_room_admin_or_mod(
    room_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> bool:
    """Require user to be admin or moderator of the room."""
    if current_user.role == "admin":
        return True
    is_admin_mod = await check_room_admin_or_mod(db, room_id, current_user.id)
    if not is_admin_mod:
        raise HTTPException(status_code=403, detail="Admin or moderator access required")
    return True


async def require_room_member(
    room_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> bool:
    """Require user to be a member of the room."""
    if current_user.role == "admin":
        return True
    is_member = await check_room_member(db, room_id, current_user.id)
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this room")
    return True