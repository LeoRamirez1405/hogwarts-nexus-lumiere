from typing import Optional

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...models.chat_room import ChatRoomMember, UserConversationPreference
from ...models.message import Message
from ...models.user import User
from ...routers.messages.deps import (
    _initial_limit,
    _invalidate_conversations_cache,
    _older_than,
    _resolve_cursor,
)


async def get_messages_service(
    db: AsyncSession,
    user_id: str,
    current_user: User,
    limit: int,
    before: Optional[str],
    expand_sender: bool,
    expand_receiver: bool,
    expand_reactions: bool,
    expand_reply_to: bool,
) -> dict:
    convo_filter = or_(
        and_(
            Message.sender_id == current_user.id,
            Message.receiver_id == user_id,
        ),
        and_(
            Message.sender_id == user_id,
            Message.receiver_id == current_user.id,
        ),
    )
    convo_filter = and_(convo_filter, Message.scheduled_at.is_(None))

    first_unread_id = None
    unread_count = 0
    if not before:
        unread_filters = [
            Message.receiver_id == current_user.id,
            Message.sender_id == user_id,
            not Message.read,
        ]
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

    query_options = []
    if expand_sender:
        query_options.append(selectinload(Message.sender))
    if expand_receiver:
        query_options.append(selectinload(Message.receiver))
    if expand_reactions:
        query_options.append(selectinload(Message.reactions))
    if expand_reply_to:
        query_options.append(selectinload(Message.reply_to).selectinload(Message.sender))

    query = (
        select(Message)
        .options(*query_options)
        .where(convo_filter)
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

    if not before:
        await db.execute(
            update(Message)
            .where(
                and_(
                    Message.receiver_id == current_user.id,
                    Message.sender_id == user_id,
                    not Message.read,
                )
            )
            .values(read=True)
        )
        dm_pref = (
            await db.execute(
                select(UserConversationPreference).where(
                    and_(
                        UserConversationPreference.user_id == current_user.id,
                        UserConversationPreference.conversation_type == "dm",
                        UserConversationPreference.conversation_id == user_id,
                    )
                )
            )
        ).scalar_one_or_none()
        if dm_pref and dm_pref.unread_count != 0:
            dm_pref.unread_count = 0
        await _invalidate_conversations_cache(current_user.id)
    await db.commit()

    rows = (await db.execute(query)).scalars().all()[:eff_limit]

    return {
        "rows": rows,
        "has_more": has_more,
        "first_unread_id": first_unread_id,
        "unread_count": unread_count,
    }


async def get_messages_since_service(
    db: AsyncSession,
    last_id: str,
    current_user: User,
    limit: int,
    expand_sender: bool,
    expand_receiver: bool,
    expand_reactions: bool,
    expand_reply_to: bool,
) -> list[Message]:
    ref_msg_result = await db.execute(select(Message).where(Message.id == last_id))
    ref_msg = ref_msg_result.scalar_one_or_none()
    if not ref_msg:
        raise ValueError("Reference message not found")

    dm_filter = or_(
        and_(Message.sender_id == current_user.id, Message.receiver_id.is_not(None)),
        and_(Message.receiver_id == current_user.id, Message.sender_id.is_not(None)),
    )
    room_subq = select(ChatRoomMember.room_id).where(ChatRoomMember.user_id == current_user.id)
    room_filter = and_(Message.room_id.in_(room_subq))
    convo_filter = or_(dm_filter, room_filter)

    time_filter = and_(
        Message.created_at > ref_msg.created_at,
        or_(
            Message.created_at > ref_msg.created_at,
            and_(Message.created_at == ref_msg.created_at, Message.id > last_id),
        ),
    )

    query_options = []
    if expand_sender:
        query_options.append(selectinload(Message.sender))
    if expand_receiver:
        query_options.append(selectinload(Message.receiver))
    if expand_reactions:
        query_options.append(selectinload(Message.reactions))
    if expand_reply_to:
        query_options.append(selectinload(Message.reply_to).selectinload(Message.sender))

    query = (
        select(Message)
        .options(*query_options)
        .where(and_(convo_filter, time_filter, Message.scheduled_at.is_(None)))
        .order_by(Message.created_at.asc(), Message.id.asc())
        .limit(limit)
    )

    result = await db.execute(query)
    return result.scalars().all()