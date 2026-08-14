"""Conversation-list building.

``build_conversations`` assembles the unified DM + room conversation list from
denormalized ``UserConversationPreference`` rows, with a legacy fallback for
rows that existed before denormalization was introduced.
"""

from datetime import datetime
from typing import List

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ....models.chat_room import ChatRoom, ChatRoomMember, UserConversationPreference
from ....models.message import Message
from ....models.user import User
from ....schemas.message import ConversationResponse, MessageResponse
from .message import _preview_message
from app.utils.dates import utcnow


async def build_conversations(
    db: AsyncSession, current_user: User
) -> List[ConversationResponse]:
    prefs_result = await db.execute(
        select(UserConversationPreference).where(
            UserConversationPreference.user_id == current_user.id
        )
    )
    all_prefs = prefs_result.scalars().all()

    dm_prefs = [p for p in all_prefs if p.conversation_type == "dm"]
    room_prefs = [p for p in all_prefs if p.conversation_type == "room"]

    hidden_dm_ids = {p.conversation_id for p in dm_prefs if p.hidden}
    hidden_room_ids = {p.conversation_id for p in room_prefs if p.hidden}

    muted_dm: dict[str, datetime | None] = {}
    for p in dm_prefs:
        if p.muted_until is not None:
            if p.muted_until > utcnow():
                muted_dm[p.conversation_id] = p.muted_until
            elif p.muted_until <= utcnow():
                p.muted_until = None

    membership_result = await db.execute(
        select(ChatRoomMember).where(ChatRoomMember.user_id == current_user.id)
    )
    memberships = membership_result.scalars().all()
    muted_rooms = {}
    last_read_map = {}
    for m in memberships:
        if m.muted_until is not None:
            muted_rooms[m.room_id] = m.muted_until
        last_read_map[m.room_id] = m.last_read_at

    dm_user_ids = [p.conversation_id for p in dm_prefs]
    if dm_user_ids:
        users_result = await db.execute(select(User).where(User.id.in_(dm_user_ids)))
        dm_users = {u.id: u for u in users_result.scalars().all()}

    room_ids = [p.conversation_id for p in room_prefs]
    if room_ids:
        rooms_result = await db.execute(
            select(ChatRoom)
            .where(ChatRoom.id.in_(room_ids))
            .options(selectinload(ChatRoom.members).selectinload(ChatRoomMember.user))
        )
        rooms = {r.id: r for r in rooms_result.scalars().all()}

    dm_map = {}
    for pref in dm_prefs:
        other = dm_users.get(pref.conversation_id)
        if not other:
            if pref.conversation_id in hidden_dm_ids:
                partner = (
                    await db.execute(select(User).where(User.id == pref.conversation_id))
                ).scalar_one_or_none()
                if not partner:
                    continue
                other = partner
            else:
                continue
        dm_is_muted = pref.conversation_id in muted_dm

        last_message = None
        if pref.last_message_id and pref.last_message_at:
            last_message = MessageResponse(
                id=pref.last_message_id,
                sender_id=pref.last_message_sender_id or "",
                receiver_id=current_user.id if pref.last_message_sender_id != current_user.id else other.id,
                room_id=None,
                reply_to_id=None,
                kind=pref.last_message_kind or "text",
                body=pref.last_message_body,
                attachment_url=pref.last_message_attachment_url,
                attachment_type=pref.last_message_attachment_type,
                attachment_name=pref.last_message_attachment_name,
                metadata=None,
                read=True,
                pinned=False,
                created_at=pref.last_message_at,
                sender=other if pref.last_message_sender_id == other.id else None,
                receiver=other if pref.last_message_sender_id != other.id else None,
                room=None,
                poll=None,
                reply_to=None,
                reactions=[],
            )

        is_hidden = pref.conversation_id in hidden_dm_ids
        dm_map[pref.conversation_id] = ConversationResponse(
            type="direct",
            id=other.id,
            name=other.name,
            avatar_url=other.avatar_url,
            subtitle=other.house,
            last_message=last_message,
            unread_count=pref.unread_count if not dm_is_muted else 0,
            is_muted=dm_is_muted,
            is_pinned=bool(pref.pinned_at),
            is_hidden=is_hidden,
            is_archived=is_hidden,
            hidden=is_hidden,
            last_active_at=other.last_active_at,
        )

    room_convs = []
    now = utcnow()
    for pref in room_prefs:
        room = rooms.get(pref.conversation_id)
        if not room:
            continue

        is_muted = False
        if pref.conversation_id in muted_rooms:
            mu = muted_rooms[pref.conversation_id]
            if mu is None or mu > now:
                is_muted = True

        online_count = sum(
            1 for m in room.members
            if m.user and m.user.last_active_at
            and (now - m.user.last_active_at).total_seconds() < 300
        )

        last_message = None
        if pref.last_message_id and pref.last_message_at:
            sender_id = pref.last_message_sender_id or ""
            sender = next((m.user for m in room.members if m.user_id == sender_id), None)
            last_message = MessageResponse(
                id=pref.last_message_id,
                sender_id=sender_id,
                receiver_id=None,
                room_id=room.id,
                reply_to_id=None,
                kind=pref.last_message_kind or "text",
                body=pref.last_message_body,
                attachment_url=pref.last_message_attachment_url,
                attachment_type=pref.last_message_attachment_type,
                attachment_name=pref.last_message_attachment_name,
                metadata=None,
                read=True,
                pinned=False,
                created_at=pref.last_message_at,
                sender=sender,
                receiver=None,
                room=None,
                poll=None,
                reply_to=None,
                reactions=[],
            )

        is_hidden_room = pref.conversation_id in hidden_room_ids
        room_convs.append(
            ConversationResponse(
                type="room",
                id=room.id,
                name=room.name,
                avatar_url=room.avatar_url,
                subtitle=f"{len(room.members)} miembros",
                last_message=last_message,
                unread_count=pref.unread_count if not is_muted else 0,
                online_count=online_count,
                is_pinned=bool(pref.pinned_at),
                is_hidden=is_hidden_room,
                is_archived=is_hidden_room,
                hidden=is_hidden_room,
            )
        )

    # ---- Fallback: conversations without a preference row ----
    known_dm_ids = set(dm_map.keys())
    known_room_ids = {c.id for c in room_convs}

    legacy_partner_rows = (
        await db.execute(
            select(Message.sender_id, Message.receiver_id)
            .where(
                Message.room_id.is_(None),
                or_(
                    Message.sender_id == current_user.id,
                    Message.receiver_id == current_user.id,
                ),
            )
            .distinct()
        )
    ).all()
    legacy_partners = {
        other
        for sender_id, receiver_id in legacy_partner_rows
        for other in (sender_id, receiver_id)
        if other and other != current_user.id
    }
    legacy_partners -= known_dm_ids
    legacy_partners -= hidden_dm_ids
    if legacy_partners:
        legacy_users_result = await db.execute(
            select(User).where(User.id.in_(legacy_partners))
        )
        legacy_users = {u.id: u for u in legacy_users_result.scalars().all()}
        for partner_id in legacy_partners:
            partner = legacy_users.get(partner_id)
            if not partner:
                continue
            last_msg = (
                await db.execute(
                    select(Message)
                    .options(selectinload(Message.sender))
                    .where(
                        Message.room_id.is_(None),
                        or_(
                            and_(Message.sender_id == current_user.id, Message.receiver_id == partner_id),
                            and_(Message.sender_id == partner_id, Message.receiver_id == current_user.id),
                        ),
                    )
                    .order_by(Message.created_at.desc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            dm_map[partner_id] = ConversationResponse(
                type="direct",
                id=partner.id,
                name=partner.name,
                avatar_url=partner.avatar_url,
                subtitle=partner.house,
                last_message=_preview_message(last_msg, partner) if last_msg else None,
                unread_count=0,
                is_muted=False,
                is_pinned=False,
                last_active_at=partner.last_active_at,
            )

    membership_ids = {m.room_id for m in memberships}
    legacy_room_ids = membership_ids - known_room_ids - hidden_room_ids
    if legacy_room_ids:
        legacy_rooms_result = await db.execute(
            select(ChatRoom)
            .where(ChatRoom.id.in_(legacy_room_ids))
            .options(selectinload(ChatRoom.members).selectinload(ChatRoomMember.user))
        )
        legacy_rooms = {r.id: r for r in legacy_rooms_result.scalars().all()}
        for room_id in legacy_room_ids:
            member_row = next((m for m in memberships if m.room_id == room_id), None)
            if member_row and member_row.pending:
                continue
            room = legacy_rooms.get(room_id)
            if not room:
                continue
            last_msg = (
                await db.execute(
                    select(Message)
                    .options(selectinload(Message.sender))
                    .where(Message.room_id == room_id)
                    .order_by(Message.created_at.desc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            online_count = sum(
                1 for m in room.members
                if m.user and m.user.last_active_at
                and (now - m.user.last_active_at).total_seconds() < 300
            )
            sender = None
            if last_msg:
                sender = next((m.user for m in room.members if m.user_id == last_msg.sender_id), None)
            room_convs.append(
                ConversationResponse(
                    type="room",
                    id=room.id,
                    name=room.name,
                    avatar_url=room.avatar_url,
                    subtitle=f"{len(room.members)} miembros",
                    last_message=_preview_message(last_msg, sender) if last_msg else None,
                    unread_count=0,
                    online_count=online_count,
                    is_pinned=False,
                )
            )

    all_convs = list(dm_map.values()) + room_convs
    all_convs.sort(
        key=lambda c: (not c.is_pinned, c.last_message.created_at if c.last_message else datetime.min),
        reverse=True,
    )
    return all_convs