"""Serialization helpers and conversation-list building for the messages router."""

import json
from datetime import datetime
from typing import List, Optional

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...models.chat_room import ChatRoom, ChatRoomMember, UserConversationPreference
from ...models.message import Message, Poll
from ...models.user import User
from ...schemas.message import (
    ChatRoomMemberResponse,
    ChatRoomResponse,
    ConversationResponse,
    MessageReactionResponse,
    MessageResponse,
    PollOptionResponse,
    PollResponse,
)
from .deps import _invalidate_conversations_caches


def serialize_poll(poll: Poll, user_id: str) -> PollResponse:
    total_votes = sum(len(opt.votes) for opt in poll.options)
    my_votes = []
    options_out = []
    for opt in poll.options:
        voted_by_me = any(v.user_id == user_id for v in opt.votes)
        if voted_by_me:
            my_votes.append(opt.id)
        options_out.append(
            PollOptionResponse(
                id=opt.id,
                label=opt.label,
                option_index=opt.option_index,
                votes_count=len(opt.votes),
                voted_by_me=voted_by_me,
            )
        )
    return PollResponse(
        id=poll.id,
        question=poll.question,
        multi_choice=poll.multi_choice,
        total_votes=total_votes,
        options=options_out,
        my_option_ids=my_votes,
    )


async def serialize_message(
    db: AsyncSession, msg: Message, current_user_id: str,
    expand_sender: bool = False, expand_receiver: bool = False,
    expand_reactions: bool = False, expand_reply_to: bool = False,
) -> MessageResponse:
    poll_data = None
    if msg.kind == "poll" and msg.poll:
        poll_data = serialize_poll(msg.poll, current_user_id)
    metadata = None
    if msg.metadata_json:
        try:
            metadata = json.loads(msg.metadata_json)
        except Exception:
            pass

    reply_to_data = None
    if expand_reply_to and msg.reply_to_id and msg.reply_to:
        reply_to_data = await serialize_message(
            db, msg.reply_to, current_user_id,
            expand_sender=expand_sender, expand_receiver=expand_receiver,
            expand_reactions=expand_reactions,
        )

    reactions_out = []
    if expand_reactions:
        for r in (msg.reactions or []):
            reactions_out.append(
                MessageReactionResponse(
                    id=r.id,
                    message_id=r.message_id,
                    user_id=r.user_id,
                    emoji=r.emoji,
                    created_at=r.created_at,
                )
            )

    sender_data = msg.sender if expand_sender else None
    receiver_data = msg.receiver if expand_receiver else None

    return MessageResponse(
    id=msg.id,
    sender_id=msg.sender_id,
    receiver_id=msg.receiver_id,
    room_id=msg.room_id,
    reply_to_id=msg.reply_to_id,
    forwarded_from_id=msg.forwarded_from_id,
    forwarded=bool(msg.forwarded),
    starred=bool(msg.starred),
    disappear_at=msg.disappear_at,
    scheduled_at=msg.scheduled_at,
    kind=msg.kind,
    body=msg.body,
    attachment_url=msg.attachment_url,
    attachment_type=msg.attachment_type,
    attachment_name=msg.attachment_name,
    metadata=metadata,
    read=msg.read,
    pinned=bool(msg.pinned),
    edited=bool(msg.edited),
    edited_at=msg.edited_at,
    created_at=msg.created_at,
    sender=sender_data,
    receiver=receiver_data,
    room=None,
    poll=poll_data,
    reply_to=reply_to_data,
    reactions=reactions_out,
  )


def serialize_room(room: ChatRoom, user_id: str) -> ChatRoomResponse:
    members_out = []
    for m in room.members:
        members_out.append(
            ChatRoomMemberResponse(
                id=m.id,
                room_id=m.room_id,
                user_id=m.user_id,
                role=m.role,
                muted_until=m.muted_until,
                joined_at=m.joined_at,
                user=m.user,
            )
        )
    return ChatRoomResponse(
        id=room.id,
        name=room.name,
        description=room.description,
        avatar_url=room.avatar_url,
        type=room.type,
        closed=room.closed,
        created_by=room.created_by,
        created_at=room.created_at,
        members=members_out,
    )


async def build_conversations(
    db: AsyncSession, current_user: User
) -> List[ConversationResponse]:
    # Get all conversation preferences for this user (includes denormalized last_message + unread_count)
    prefs_result = await db.execute(
        select(UserConversationPreference).where(
            UserConversationPreference.user_id == current_user.id
        )
    )
    all_prefs = prefs_result.scalars().all()

    # Separate DM and room preferences
    dm_prefs = [p for p in all_prefs if p.conversation_type == "dm"]
    room_prefs = [p for p in all_prefs if p.conversation_type == "room"]

    hidden_dm_ids = {p.conversation_id for p in dm_prefs if p.hidden}
    hidden_room_ids = {p.conversation_id for p in room_prefs if p.hidden}

    # DM mute status
    muted_dm: dict[str, Optional[datetime]] = {}
    for p in dm_prefs:
        if p.muted_until is not None:
            if p.muted_until > datetime.utcnow():
                muted_dm[p.conversation_id] = p.muted_until
            elif p.muted_until <= datetime.utcnow():
                p.muted_until = None

    # Room memberships for mute status and last_read_at
    membership_result = await db.execute(
        select(ChatRoomMember).where(ChatRoomMember.user_id == current_user.id)
    )
    muted_rooms = {}
    last_read_map = {}
    for m in membership_result.scalars().all():
        if m.muted_until is not None:
            muted_rooms[m.room_id] = m.muted_until
        last_read_map[m.room_id] = m.last_read_at

    # Get user IDs and room IDs we need to load
    dm_user_ids = [p.conversation_id for p in dm_prefs if p.conversation_id not in hidden_dm_ids]
    room_ids = [p.conversation_id for p in room_prefs if p.conversation_id not in hidden_room_ids]

    # Batch load users for DMs
    dm_users = {}
    if dm_user_ids:
        users_result = await db.execute(select(User).where(User.id.in_(dm_user_ids)))
        dm_users = {u.id: u for u in users_result.scalars().all()}

    # Batch load rooms
    rooms = {}
    if room_ids:
        rooms_result = await db.execute(
            select(ChatRoom)
            .where(ChatRoom.id.in_(room_ids))
            .options(selectinload(ChatRoom.members).selectinload(ChatRoomMember.user))
        )
        rooms = {r.id: r for r in rooms_result.scalars().all()}

    # Build DM conversations using denormalized data
    dm_map = {}
    for pref in dm_prefs:
        if pref.conversation_id in hidden_dm_ids:
            continue
        other = dm_users.get(pref.conversation_id)
        if not other:
            continue
        dm_is_muted = pref.conversation_id in muted_dm

        # Create a minimal last_message from denormalized data
        last_message = None
        if pref.last_message_id and pref.last_message_at:
            last_message = MessageResponse(
                id=pref.last_message_id,
                sender_id=pref.last_message_sender_id or "",
                receiver_id=current_user.id if pref.last_message_sender_id != current_user.id else other.id,
                room_id=None,
                reply_to_id=None,
                kind="text",
                body=pref.last_message_body,
                attachment_url=None,
                attachment_type=None,
                attachment_name=None,
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
            last_active_at=other.last_active_at,
        )

    # Build room conversations using denormalized data
    room_convs = []
    now = datetime.utcnow()
    for pref in room_prefs:
        if pref.conversation_id in hidden_room_ids:
            continue
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

        # Create last_message from denormalized data
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
                kind="text",
                body=pref.last_message_body,
                attachment_url=None,
                attachment_type=None,
                attachment_name=None,
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
            )
        )

    all_convs = list(dm_map.values()) + room_convs
    all_convs.sort(
        key=lambda c: (not c.is_pinned, c.last_message.created_at if c.last_message else datetime.min),
        reverse=True,
    )
    return all_convs


async def _update_conversation_preferences(
    db: AsyncSession, message: Message, sender: User
):
    """Update UserConversationPreference denormalized fields for sender and all recipients."""

    body_preview = (message.body or "")[:200] if message.body else ""
    if not body_preview and message.attachment_url:
        body_preview = "📎 Adjunto"

    # Determine conversation key
    if message.room_id:
        conversation_type = "room"
        conversation_id = message.room_id
        # Get all room members
        member_result = await db.execute(
            select(ChatRoomMember.user_id).where(ChatRoomMember.room_id == message.room_id)
        )
        recipient_ids = [row[0] for row in member_result.all()]
    else:
        conversation_type = "dm"
        conversation_id = message.receiver_id
        recipient_ids = [message.receiver_id] if message.receiver_id else []

    # Collect all user IDs that need cache invalidation
    affected_user_ids = {sender.id}
    affected_user_ids.update(recipient_ids)

    # Update for sender
    await _upsert_conversation_pref(
        db,
        user_id=sender.id,
        conversation_type=conversation_type,
        conversation_id=conversation_id,
        last_message_id=message.id,
        last_message_body=body_preview,
        last_message_at=message.created_at,
        last_message_sender_id=sender.id,
        # Don't increment unread for sender
        unread_increment=0,
    )

    # Update for each recipient (increment unread)
    for recipient_id in recipient_ids:
        if recipient_id == sender.id:
            continue
        await _upsert_conversation_pref(
            db,
            user_id=recipient_id,
            conversation_type=conversation_type,
            conversation_id=conversation_id,
            last_message_id=message.id,
            last_message_body=body_preview,
            last_message_at=message.created_at,
            last_message_sender_id=sender.id,
            unread_increment=1,
        )

    await db.commit()

    # Invalidate conversations cache for all affected users
    await _invalidate_conversations_caches(list(affected_user_ids))


async def _upsert_conversation_pref(
    db: AsyncSession,
    user_id: str,
    conversation_type: str,
    conversation_id: str,
    last_message_id: str,
    last_message_body: str,
    last_message_at: datetime,
    last_message_sender_id: str,
    unread_increment: int,
):
    """Upsert a UserConversationPreference with denormalized message data."""
    result = await db.execute(
        select(UserConversationPreference).where(
            and_(
                UserConversationPreference.user_id == user_id,
                UserConversationPreference.conversation_type == conversation_type,
                UserConversationPreference.conversation_id == conversation_id,
            )
        )
    )
    pref = result.scalar_one_or_none()
    if pref:
        pref.last_message_id = last_message_id
        pref.last_message_body = last_message_body
        pref.last_message_at = last_message_at
        pref.last_message_sender_id = last_message_sender_id
        if unread_increment > 0:
            pref.unread_count += unread_increment
    else:
        pref = UserConversationPreference(
            user_id=user_id,
            conversation_type=conversation_type,
            conversation_id=conversation_id,
            last_message_id=last_message_id,
            last_message_body=last_message_body,
            last_message_at=last_message_at,
            last_message_sender_id=last_message_sender_id,
            unread_count=unread_increment,
        )
        db.add(pref)
