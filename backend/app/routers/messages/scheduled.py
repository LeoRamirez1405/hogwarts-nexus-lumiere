"""Scheduled message endpoints."""

import json
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.chat_room import ChatRoom, ChatRoomMember
from ...models.message import Message
from ...models.user import User
from ...schemas.message import MessageResponse, ScheduledMessageRequest, ScheduledMessageUpdate
from .serializers import serialize_message
from app.utils.dates import utcnow

router = APIRouter()


def _to_naive_utc(dt: datetime) -> datetime:
    """Normalize a possibly tz-aware datetime to naive UTC.

    Pydantic parses ISO strings ending in ``Z`` / with an offset as
    tz-aware datetimes; the rest of the app compares against naive
    ``utcnow()`` and stores naive datetimes, so normalize on the
    way in to avoid ``TypeError: can't compare offset-naive and
    offset-aware datetimes``.
    """
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


@router.post("/scheduled", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def create_scheduled_message(
    schedule_data: ScheduledMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a scheduled message. The message is stored with scheduled_at;
    actual delivery at scheduled_at requires a background scheduler (future work).
    """
    scheduled_at = _to_naive_utc(schedule_data.scheduled_at)
    if scheduled_at <= utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="scheduled_at must be in the future",
        )

    receiver = None
    if schedule_data.receiver_id:
        receiver_result = await db.execute(
            select(User).where(User.id == schedule_data.receiver_id)
        )
        receiver = receiver_result.scalar_one_or_none()
        if not receiver:
            raise HTTPException(status_code=404, detail="Receiver not found")

    room = None
    if schedule_data.room_id:
        member_result = await db.execute(
            select(ChatRoomMember).where(
                and_(
                    ChatRoomMember.room_id == schedule_data.room_id,
                    ChatRoomMember.user_id == current_user.id,
                )
            )
        )
        if not member_result.scalar_one_or_none():
            raise HTTPException(
                status_code=403, detail="Not a member of this chat room"
            )
        room_result = await db.execute(
            select(ChatRoom).where(ChatRoom.id == schedule_data.room_id)
        )
        room = room_result.scalar_one_or_none()
        if room and room.closed and current_user.role != "admin":
            raise HTTPException(
                status_code=403, detail="This room is closed by an administrator"
            )

    metadata_json = None
    if schedule_data.metadata:
        metadata_json = json.dumps(schedule_data.metadata)

    message = Message(
        sender_id=current_user.id,
        receiver_id=schedule_data.receiver_id,
        room_id=schedule_data.room_id,
        kind=schedule_data.kind or "text",
        body=schedule_data.body,
        attachment_url=schedule_data.attachment_url,
        attachment_type=schedule_data.attachment_type,
        attachment_name=schedule_data.attachment_name,
        metadata_json=metadata_json,
        scheduled_at=scheduled_at,
        read=False,
    )
    db.add(message)
    await db.flush()
    await db.commit()
    await db.refresh(message)

    return await serialize_message(
        db, message, current_user.id,
        expand_sender=True, expand_receiver=True, expand_room=True,
    )


@router.get("/scheduled", response_model=List[MessageResponse])
async def list_scheduled_messages(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List current user's scheduled messages (sent by them)."""
    stmt = (
        select(Message)
        .where(and_(Message.sender_id == current_user.id, Message.scheduled_at != None))  # noqa: E711
        .order_by(Message.scheduled_at.asc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [
        await serialize_message(
            db, m, current_user.id,
            expand_sender=True, expand_receiver=True, expand_room=True,
        )
        for m in rows
    ]


@router.patch("/{message_id}/scheduled", response_model=MessageResponse)
async def update_scheduled_message(
    message_id: str,
    update_data: ScheduledMessageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Edit a scheduled message (body and/or scheduled_at) before it's sent."""
    msg = (
        await db.execute(select(Message).where(Message.id == message_id))
    ).scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the sender can edit this scheduled message")
    if msg.scheduled_at is None:
        raise HTTPException(status_code=400, detail="Message is not scheduled (already sent or cancelled)")

    if update_data.scheduled_at is not None:
        new_scheduled_at = _to_naive_utc(update_data.scheduled_at)
        if new_scheduled_at <= utcnow():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="scheduled_at must be in the future",
            )
        msg.scheduled_at = new_scheduled_at
    if update_data.body is not None:
        msg.body = update_data.body

    await db.commit()
    await db.refresh(msg)

    return await serialize_message(
        db, msg, current_user.id,
        expand_sender=True, expand_receiver=True, expand_room=True,
    )


@router.delete("/{message_id}/scheduled", status_code=204)
async def cancel_scheduled_message(
    message_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel (delete) a scheduled message before it's sent."""
    msg = (
        await db.execute(select(Message).where(Message.id == message_id))
    ).scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the sender can cancel this scheduled message")
    if msg.scheduled_at is None:
        raise HTTPException(status_code=400, detail="Message is not scheduled")

    await db.delete(msg)
    await db.commit()
    return {"ok": True}
