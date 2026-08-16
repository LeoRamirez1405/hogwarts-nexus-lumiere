"""Room-scoped messaging endpoints: fetch and send messages within a room."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ....database import get_db
from ....middleware.auth import get_current_user
from ....models.chat_room import ChatRoomMember, UserConversationPreference
from ....models.message import Message, Poll, PollOption
from ....models.user import User
from ....schemas.message import (
    MessageCreate,
    MessagePage,
    MessageResponse,
)
from ..core import send_message
from ..deps import _initial_limit, _invalidate_conversations_cache, _older_than, _resolve_cursor
from ..serializers import serialize_message

router = APIRouter()


@router.get("/rooms/{room_id}/messages", response_model=MessagePage)
async def get_room_messages(
    room_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(30, ge=1, le=100),
    before: Optional[str] = None,
    expand: str = Query("", description="Comma-separated list of relations to expand: sender,receiver,reactions,reply_to"),
):
    expand_sender = "sender" in expand
    expand_receiver = "receiver" in expand
    expand_reactions = "reactions" in expand
    expand_reply_to = "reply_to" in expand

    member_result = await db.execute(
        select(ChatRoomMember).where(
            and_(
                ChatRoomMember.room_id == room_id,
                ChatRoomMember.user_id == current_user.id,
            )
        )
    )
    member = member_result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this room")

    room_cutoff = (
        await db.execute(
            select(UserConversationPreference.deleted_at).where(
                and_(
                    UserConversationPreference.user_id == current_user.id,
                    UserConversationPreference.conversation_type == "room",
                    UserConversationPreference.conversation_id == room_id,
                )
            )
        )
    ).scalar_one_or_none()

    # Unread marker is only meaningful on the initial load (no cursor).
    first_unread_id = None
    unread_count = 0
    last_read = member.last_read_at
    if not before:
        unread_filters = [
            Message.room_id == room_id,
            Message.sender_id != current_user.id,
        ]
        if last_read is not None:
            unread_filters.append(Message.created_at > last_read)
        if room_cutoff is not None:
            unread_filters.append(Message.created_at > room_cutoff)
        first_unread_id = (
            await db.execute(
                select(Message.id)
                .where(and_(*unread_filters))
                .order_by(Message.created_at.asc(), Message.id.asc())
                .limit(1)
            )
        ).scalar_one_or_none()
        unread_count = (
            await db.execute(
                select(func.count(Message.id)).where(and_(*unread_filters))
            )
        ).scalar() or 0

    eff_limit = _initial_limit(limit, unread_count, first_unread_id is not None)

    # Build query with conditional eager loading based on expand
    query_options = []
    if expand_sender:
        query_options.append(selectinload(Message.sender))
    if expand_receiver:
        query_options.append(selectinload(Message.receiver))
    if expand_reactions:
        query_options.append(selectinload(Message.reactions))
    if expand_reply_to:
        query_options.append(selectinload(Message.reply_to).selectinload(Message.sender))

    # Always load poll for poll messages
    query_options.append(selectinload(Message.poll).selectinload(Poll.options).selectinload(PollOption.votes))

    room_filters = [
        Message.room_id == room_id,
        Message.scheduled_at.is_(None),
    ]
    if room_cutoff is not None:
        room_filters.append(Message.created_at > room_cutoff)

    query = (
        select(Message)
        .where(and_(*room_filters))
        .options(*query_options)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(eff_limit + 1)
    )
    cursor = await _resolve_cursor(db, before)
    if cursor is not None:
        query = query.where(_older_than(cursor))

    result = await db.execute(query)
    rows = result.scalars().all()
    has_more = len(rows) > eff_limit
    rows = rows[:eff_limit]

    # Advance this member's last-read marker on the initial load.
    changed = False
    if not before and rows:
        newest = max(m.created_at for m in rows)
        if member.last_read_at is None or newest > member.last_read_at:
            member.last_read_at = newest
            changed = True
        # Mirror the read position into the denormalized unread counter and
        # drop the cached conversation list so badges are accurate on reload.
        room_pref = (
            await db.execute(
                select(UserConversationPreference).where(
                    and_(
                        UserConversationPreference.user_id == current_user.id,
                        UserConversationPreference.conversation_type == "room",
                        UserConversationPreference.conversation_id == room_id,
                    )
                )
            )
        ).scalar_one_or_none()
        if room_pref and room_pref.unread_count != 0:
            room_pref.unread_count = 0
            changed = True

    if changed:
        await _invalidate_conversations_cache(current_user.id)
        await db.commit()
        # The commit expired every loaded row; re-select so eager loads
        # repopulate sender/receiver/reactions/reply_to and serialization
        # below does not lazy-load them one query per message.
        rows = (await db.execute(query)).scalars().all()[:eff_limit]

    out = [
        await serialize_message(
            db, m, current_user.id,
            expand_sender=expand_sender, expand_receiver=expand_receiver,
            expand_reactions=expand_reactions, expand_reply_to=expand_reply_to,
        )
        for m in rows
    ]
    out.reverse()  # oldest-first for rendering
    return MessagePage(
        messages=out,
        has_more=has_more,
        first_unread_id=first_unread_id,
        unread_count=unread_count,
    )


@router.post(
    "/rooms/{room_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_room_message(
    room_id: str,
    message_data: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member_result = await db.execute(
        select(ChatRoomMember).where(
            and_(
                ChatRoomMember.room_id == room_id,
                ChatRoomMember.user_id == current_user.id,
            )
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this room")

    message_data.room_id = room_id
    return await send_message(message_data, db, current_user)
