"""Core message operations: send, read, edit, delete, forward, pin and star."""

import json
import base64
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.chat_room import ChatRoom, ChatRoomMember, UserConversationPreference
from ...models.message import Message, Poll, PollOption
from ...models.user import User
from ...models.e2e_encryption import EncryptedMessage
from ...notifications_service import notify, resolve_mentions, N
from ...schemas.message import (
    ForwardMessageRequest,
    MessageCreate,
    MessagePage,
    MessageResponse,
)
from ...ws_manager import manager
from .deps import (
    _initial_limit,
    _invalidate_conversations_cache,
    _older_than,
    _PIN_OPTS,
    _resolve_cursor,
)
from .serializers import _update_conversation_preferences, serialize_message

router = APIRouter()


async def create_mention_notifications(
    db: AsyncSession,
    sender: User,
    body: str,
    room_name: str,
    room_id: str,
    message_id: str,
):
    """Notify every user "@mentioned" in a room message (resolution lives in the
    shared notifications_service)."""
    for mentioned_user in await resolve_mentions(db, body):
        await notify(
            db,
            user_id=mentioned_user.id,
            type=N.MENTION,
            title=f"@{sender.name} te mencionó en {room_name}",
            body=body[:200],
            # related_id encodes the jump target: "<room_id>:<message_id>"
            related_id=f"{room_id}:{message_id}",
            actor_id=sender.id,
        )


@router.post("/", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    message_data: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if message_data.receiver_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot send message to yourself",
        )

    receiver = None
    if message_data.receiver_id:
        receiver_result = await db.execute(
            select(User).where(User.id == message_data.receiver_id)
        )
        receiver = receiver_result.scalar_one_or_none()
        if not receiver:
            raise HTTPException(status_code=404, detail="Receiver not found")

    room = None
    if message_data.room_id:
        member_result = await db.execute(
            select(ChatRoomMember).where(
                and_(
                    ChatRoomMember.room_id == message_data.room_id,
                    ChatRoomMember.user_id == current_user.id,
                )
            )
        )
        if not member_result.scalar_one_or_none():
            raise HTTPException(
                status_code=403, detail="Not a member of this chat room"
            )
        room_result = await db.execute(
            select(ChatRoom).where(ChatRoom.id == message_data.room_id)
        )
        room = room_result.scalar_one_or_none()
        if room and room.closed and current_user.role != "admin":
            raise HTTPException(
                status_code=403, detail="This room is closed by an administrator"
)

    metadata_json = None
    if message_data.metadata:
        metadata_json = json.dumps(message_data.metadata)

    reply_to_id = message_data.reply_to_id
    disappear_at = message_data.disappear_at

    is_e2e = message_data.e2e_encrypted

    message = Message(
        sender_id=current_user.id,
        receiver_id=message_data.receiver_id,
        room_id=message_data.room_id,
        reply_to_id=reply_to_id,
        kind=message_data.kind or "text",
        body=message_data.body,
        attachment_url=message_data.attachment_url,
        attachment_type=message_data.attachment_type,
        attachment_name=message_data.attachment_name,
        metadata_json=metadata_json,
        disappear_at=disappear_at,
        e2e_encrypted=is_e2e,
    )

    db.add(message)
    await db.flush()

    # If E2E encrypted, store the encrypted envelope
    if is_e2e and message_data.e2e_ciphertext:
        encrypted_msg = EncryptedMessage(
            message_id=message.id,
            sender_id=current_user.id,
            recipient_id=message_data.receiver_id,
            ciphertext=base64.b64decode(message_data.e2e_ciphertext),
            sender_ephemeral_public=base64.b64decode(message_data.e2e_sender_ephemeral or ""),
            counter=message_data.e2e_counter or 0,
            previous_counter=message_data.e2e_previous_counter,
            session_version=message_data.e2e_message_version or 3,
            kind=message.kind,
            has_attachment=bool(message.attachment_url),
        )
        db.add(encrypted_msg)

    if message_data.kind == "poll" and message_data.poll:
        poll_data = message_data.poll
        poll = Poll(
            message_id=message.id,
            question=poll_data.question,
            multi_choice=poll_data.multi_choice,
        )
        db.add(poll)
        await db.flush()
        for idx, label in enumerate(poll_data.options):
            option = PollOption(
                poll_id=poll.id,
                label=label,
                option_index=idx,
            )
            db.add(option)

    await db.commit()
    await db.refresh(message)

    if message.poll:
        await db.refresh(message.poll)
        for opt in message.poll.options:
            await db.refresh(opt)

    notified = False
    # Create mention notifications for room messages
    if message.room_id and message.body and "@" in message.body:
        room_result2 = await db.execute(
            select(ChatRoom).where(ChatRoom.id == message.room_id)
        )
        room_obj = room_result2.scalar_one_or_none()
        room_name = room_obj.name if room_obj else "el grupo"
        await create_mention_notifications(
            db, current_user, message.body, room_name, message.room_id, message.id
        )
        notified = True

    # Direct message: let the recipient know they got a new message.
    if message.receiver_id and not message.room_id:
        preview = (message.body or "").strip()
        if not preview:
            preview = "Te envió un adjunto" if message.attachment_url else "Nuevo mensaje"
        await notify(
            db,
            user_id=message.receiver_id,
            type=N.DM_MESSAGE,
            title=f"Nuevo mensaje de {current_user.name}",
            body=preview[:200],
            related_id=current_user.id,
            actor_id=current_user.id,
        )
        notified = True

    if notified:
        await db.commit()

    # Update denormalized conversation preferences for sender and recipients
    await _update_conversation_preferences(db, message, current_user)

    # Expunge so the re-query actually reloads relationships instead of
    # returning the cached row. Explicit selectinload is required because the
    # automatic selectin default is skipped for self-referential reply_to.
    db.expunge(message)
    result = await db.execute(
        select(Message)
        .options(selectinload(Message.reply_to).selectinload(Message.sender))
        .where(Message.id == message.id)
    )
    message = result.scalar_one()

    return await serialize_message(
        db,
        message,
        current_user.id,
        expand_sender=True,
        expand_reply_to=True,
    )


class MessageEditRequest(BaseModel):
    body: str


@router.patch("/{message_id}", response_model=MessageResponse)
async def edit_message(
    message_id: str,
    edit_data: MessageEditRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msg_result = await db.execute(select(Message).where(Message.id == message_id))
    message = msg_result.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    # Only sender can edit
    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the sender can edit this message")

    # Only text messages can be edited
    if message.kind != "text":
        raise HTTPException(status_code=400, detail="Only text messages can be edited")

    message.body = edit_data.body
    message.edited = True
    message.edited_at = datetime.utcnow()
    await db.commit()
    await db.refresh(message)

    serialized = await serialize_message(db, message, current_user.id, expand_sender=True)
    event = {
        "t": "edit",
        "c": message.room_id or message.receiver_id,
        "m": serialized.model_dump(mode="json"),
        "ts": int(datetime.utcnow().timestamp() * 1000),
    }
    if message.room_id:
        await manager.broadcast_to_room(message.room_id, event, exclude_user=current_user.id)
    elif message.receiver_id:
        await manager.send_to_user(message.receiver_id, event)
        await manager.send_to_user(current_user.id, event)

    return serialized


@router.delete("/{message_id}", status_code=204)
async def delete_message(
    message_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msg_result = await db.execute(select(Message).where(Message.id == message_id))
    message = msg_result.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    # Only sender can delete
    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the sender can delete this message")

    room_id = message.room_id
    receiver_id = message.receiver_id
    await db.delete(message)
    await db.commit()

    event = {
      "t": "delete",
      "c": room_id or receiver_id,
      "m": message_id,
      "ts": int(datetime.utcnow().timestamp() * 1000),
    }
    if room_id:
      await manager.broadcast_to_room(room_id, event)
    elif receiver_id:
      await manager.send_to_user(receiver_id, event)
      await manager.send_to_user(current_user.id, event)


@router.put("/{message_id}/pin", response_model=MessageResponse)
async def toggle_pin(
    message_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msg = (
        await db.execute(
            select(Message).where(Message.id == message_id).options(*_PIN_OPTS)
        )
    ).scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    # Authorize: room members, or either side of the DM.
    if msg.room_id:
        member = (
            await db.execute(
                select(ChatRoomMember).where(
                    and_(
                        ChatRoomMember.room_id == msg.room_id,
                        ChatRoomMember.user_id == current_user.id,
                    )
                )
            )
        ).scalar_one_or_none()
        if not member:
            raise HTTPException(status_code=403, detail="Not a member of this room")
    elif current_user.id not in (msg.sender_id, msg.receiver_id):
        raise HTTPException(status_code=403, detail="Not part of this conversation")

    msg.pinned = not bool(msg.pinned)
    await db.commit()
    await db.refresh(msg)
    return await serialize_message(db, msg, current_user.id)


@router.get("/rooms/{room_id}/pinned", response_model=List[MessageResponse])
async def list_room_pinned(
    room_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = (
        await db.execute(
            select(ChatRoomMember).where(
                and_(
                    ChatRoomMember.room_id == room_id,
                    ChatRoomMember.user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this room")

    rows = (
        await db.execute(
            select(Message)
            .where(and_(Message.room_id == room_id, Message.pinned == True))  # noqa: E712
            .options(*_PIN_OPTS)
            .order_by(Message.created_at.desc())
        )
    ).scalars().all()
    return [await serialize_message(db, m, current_user.id) for m in rows]


@router.get("/dm/{user_id}/pinned", response_model=List[MessageResponse])
async def list_dm_pinned(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    convo_filter = or_(
        and_(Message.sender_id == current_user.id, Message.receiver_id == user_id),
        and_(Message.sender_id == user_id, Message.receiver_id == current_user.id),
    )
    rows = (
        await db.execute(
            select(Message)
            .where(and_(convo_filter, Message.pinned == True))  # noqa: E712
            .options(*_PIN_OPTS)
            .order_by(Message.created_at.desc())
        )
    ).scalars().all()
    return [await serialize_message(db, m, current_user.id) for m in rows]


@router.get("/starred", response_model=List[MessageResponse])
async def list_starred_messages(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=200),
):
    room_subq = select(ChatRoomMember.room_id).where(
        ChatRoomMember.user_id == current_user.id
    )
    dm_filter = or_(
        and_(Message.sender_id == current_user.id),
        and_(Message.receiver_id == current_user.id),
    )
    rows = (
        await db.execute(
            select(Message)
            .where(and_(Message.starred == True, or_(dm_filter, Message.room_id.in_(room_subq))))  # noqa: E712
            .options(*_PIN_OPTS)
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    return [await serialize_message(db, m, current_user.id) for m in rows]


@router.get("/{user_id}", response_model=MessagePage)
async def get_messages(
    user_id: str,
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

    # Hide scheduled messages that have not been delivered yet.
    convo_filter = and_(convo_filter, Message.scheduled_at.is_(None))

    # Unread marker only on the initial load (no cursor).
    first_unread_id = None
    unread_count = 0
    if not before:
        unread_filters = [
            Message.receiver_id == current_user.id,
            Message.sender_id == user_id,
            Message.read == False,  # noqa: E712
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

    # On the initial load, clear the whole unread badge for this DM (not only
    # the messages in this page), so the conversation list count resets.
    if not before:
        await db.execute(
            update(Message)
            .where(
                and_(
                    Message.receiver_id == current_user.id,
                    Message.sender_id == user_id,
                    Message.read == False,  # noqa: E712
                )
            )
            .values(read=True)
        )
        # Mirror the read state into the denormalized conversation counter so
        # the badge survives a page reload / fresh GET /conversations.
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

    # The commit expired every loaded row; re-select so eager loads repopulate
    # sender/receiver/reactions/reply_to and serialization below does not
    # lazy-load them one query per message.
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


@router.get("/since/{last_id}", response_model=List[MessageResponse])
async def get_messages_since(
    last_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=200),
    expand: str = Query("", description="Comma-separated list of relations to expand: sender,receiver,reactions,reply_to"),
):
    """
    Catch-up endpoint: fetch messages newer than `last_id` across all conversations.
    Used by WebSocket client on reconnection to get missed messages.
    """
    expand_sender = "sender" in expand
    expand_receiver = "receiver" in expand
    expand_reactions = "reactions" in expand
    expand_reply_to = "reply_to" in expand

    # Get the reference message to determine the timestamp cutoff
    ref_msg_result = await db.execute(select(Message).where(Message.id == last_id))
    ref_msg = ref_msg_result.scalar_one_or_none()
    if not ref_msg:
        raise HTTPException(status_code=404, detail="Reference message not found")

    # Build filter: messages where current_user is participant and created_after reference message
    # This covers both DMs and room messages
    dm_filter = or_(
        and_(Message.sender_id == current_user.id, Message.receiver_id != None),
        and_(Message.receiver_id == current_user.id, Message.sender_id != None),
    )
    room_subq = select(ChatRoomMember.room_id).where(ChatRoomMember.user_id == current_user.id)
    room_filter = and_(Message.room_id.in_(room_subq))
    convo_filter = or_(dm_filter, room_filter)

    # Only messages after the reference message
    time_filter = and_(
        Message.created_at > ref_msg.created_at,
        # Tie-breaker: if same timestamp, use ID
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
        .order_by(Message.created_at.asc(), Message.id.asc())  # oldest-first for catch-up
        .limit(limit)
    )

    result = await db.execute(query)
    rows = result.scalars().all()

    out = [
        await serialize_message(
            db, m, current_user.id,
            expand_sender=expand_sender, expand_receiver=expand_receiver,
            expand_reactions=expand_reactions, expand_reply_to=expand_reply_to,
        )
        for m in rows
    ]

    return out


@router.post("/{message_id}/forward", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def forward_message(
    message_id: str,
    forward_data: ForwardMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    original = (
        await db.execute(select(Message).where(Message.id == message_id))
    ).scalar_one_or_none()
    if not original:
        raise HTTPException(status_code=404, detail="Message not found")

    target_room_id = forward_data.to_room_id or None
    target_receiver_id = forward_data.to_receiver_id or None
    if not target_room_id and not target_receiver_id:
        raise HTTPException(status_code=400, detail="to_room_id or to_receiver_id required")

    if target_room_id:
        member = (
            await db.execute(
                select(ChatRoomMember).where(
                    and_(ChatRoomMember.room_id == target_room_id, ChatRoomMember.user_id == current_user.id)
                )
            )
        ).scalar_one_or_none()
        if not member:
            raise HTTPException(status_code=403, detail="Not a member of target room")

    new_msg = Message(
        sender_id=current_user.id,
        receiver_id=target_receiver_id,
        room_id=target_room_id,
        kind=original.kind,
        body=original.body,
        attachment_url=original.attachment_url,
        attachment_type=original.attachment_type,
        attachment_name=original.attachment_name,
        metadata_json=original.metadata_json,
        forwarded=True,
        forwarded_from_id=original.id,
    )
    db.add(new_msg)
    await db.flush()
    await db.commit()
    await db.refresh(new_msg)
    return await serialize_message(db, new_msg, current_user.id, expand_sender=True)


@router.put("/{message_id}/star")
async def toggle_star(
    message_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msg = (
        await db.execute(select(Message).where(Message.id == message_id))
    ).scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    if msg.room_id:
        member = (
            await db.execute(
                select(ChatRoomMember).where(
                    and_(ChatRoomMember.room_id == msg.room_id, ChatRoomMember.user_id == current_user.id)
                )
            )
        ).scalar_one_or_none()
        if not member:
            raise HTTPException(status_code=403, detail="Not a member of this room")
    elif current_user.id not in (msg.sender_id, msg.receiver_id):
        raise HTTPException(status_code=403, detail="Not part of this conversation")

    msg.starred = not bool(msg.starred)
    await db.commit()
    return {"ok": True, "starred": msg.starred}
