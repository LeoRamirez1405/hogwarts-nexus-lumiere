import json
import base64
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, update
from sqlalchemy.orm import selectinload

from ..database import async_session
from ..models.message import Message
from ..models.chat_room import ChatRoomMember, UserConversationPreference
from ..models.user import User
from ..models.e2e_encryption import EncryptedMessage
from ..middleware.auth import get_current_user_ws
from ..ws_manager import manager
from ..services.messages.conversation_prefs import (
    _update_conversation_preferences,
    update_conversation_preferences_after_delete,
    update_conversation_preview_after_edit,
)
from .messages import serialize_message
from .messages.serializers.message import _preview_message
from app.utils.dates import utcnow


router = APIRouter()


async def get_room_members(db: AsyncSession, room_id: str):
    result = await db.execute(
        select(ChatRoomMember.user_id).where(ChatRoomMember.room_id == room_id)
    )
    return [row[0] for row in result.all()]


async def _invalidate_user_conversations_cache(user_id: str) -> None:
    """Invalidate conversations cache for a user."""
    try:
        import redis.asyncio as redis
        from ..config import settings
        r = redis.from_url(
            settings.REDIS_URL,
            max_connections=settings.REDIS_MAX_CONNECTIONS,
            decode_responses=True,
            socket_timeout=None,
            socket_connect_timeout=10,
        )
        await r.delete(f"conv:{user_id}")
        await r.close()
    except Exception:
        pass


async def _touch_presence(user_id: str, db: AsyncSession) -> None:
    """Keep ``last_active_at`` fresh so presence stays honest while the socket is open.

    The client heartbeats with ``{t: "ping"}`` every 25s (mobile) / 60s (desktop),
    so a single ``update`` per heartbeat is cheap and keeps the 5-minute
    ``last_active_at`` window from expiring.
    """
    try:
        await db.execute(
            update(User).where(User.id == user_id).values(last_active_at=utcnow())
        )
        await db.commit()
    except Exception:
        pass


async def _notify_dm_partners(db: AsyncSession, user_id: str, status: str) -> None:
    """Broadcast a presence event to the user's DM partners.

    Room presence is broadcast via ``manager.broadcast_to_room``; DMs have no room
    subscription, so notify each partner directly so the online/offline dot updates
    in real time (not only after a re-fetch of ``last_active_at``).
    """
    payload = {"t": "presence", "u": user_id, "s": status}
    try:
        result = await db.execute(
            select(UserConversationPreference.conversation_id).where(
                and_(
                    UserConversationPreference.user_id == user_id,
                    UserConversationPreference.conversation_type == "dm",
                )
            )
        )
        for (partner_id,) in result.all():
            await manager.send_to_user(partner_id, payload)
    except Exception:
        pass


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    current_user: Optional[User] = Depends(get_current_user_ws),
):
    if not current_user:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await manager.connect(current_user.id, websocket)

    # Mark the user as active the moment the socket opens.
    try:
        async with async_session() as db:
            current_user.last_active_at = utcnow()
            await db.commit()
    except Exception:
        pass

    # Add user to their rooms
    try:
        async with async_session() as db:
            room_result = await db.execute(
                select(ChatRoomMember.room_id).where(ChatRoomMember.user_id == current_user.id)
            )
            room_ids = [room_id for (room_id,) in room_result.all()]
    except Exception:
        room_ids = []
    for room_id in room_ids:
        manager.add_user_to_room(current_user.id, room_id)

    # Broadcast presence online
    online_payload = {"t": "presence", "u": current_user.id, "s": "online"}
    for room_id in manager.user_rooms.get(current_user.id, set()):
        await manager.broadcast_to_room(room_id, online_payload, exclude_user=current_user.id)
    try:
        async with async_session() as db:
            await _notify_dm_partners(db, current_user.id, "online")
    except Exception:
        pass

    try:
        while True:
            data = await websocket.receive_json()
            # Short-lived session per WS message: a long-lived session would
            # pin a pool connection for the whole socket lifetime and exhaust
            # the QueuePool (10+5) with a few open tabs.
            try:
                async with async_session() as db:
                    await handle_ws_message(current_user.id, data, db)
            except Exception:
                continue
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        # Record last activity and broadcast presence offline
        try:
            async with async_session() as db:
                await _touch_presence(current_user.id, db)
                await _notify_dm_partners(db, current_user.id, "offline")
        except Exception:
            pass
        offline_payload = {"t": "presence", "u": current_user.id, "s": "offline"}
        for room_id in manager.user_rooms.get(current_user.id, set()):
            await manager.broadcast_to_room(room_id, offline_payload, exclude_user=current_user.id)
        manager.disconnect(current_user.id)


async def handle_ws_message(user_id: str, data: dict, db: AsyncSession):
    msg_type = data.get("t")

    if msg_type == "send_message":
        await handle_send_message(user_id, data, db)
    elif msg_type == "typing_start":
        await handle_typing_start(user_id, data)
    elif msg_type == "typing_stop":
        await handle_typing_stop(user_id, data)
    elif msg_type == "mark_read":
        await handle_mark_read(user_id, data, db)
    elif msg_type == "edit_message":
        await handle_edit_message(user_id, data, db)
    elif msg_type == "delete_message":
        await handle_delete_message(user_id, data, db)
    elif msg_type == "ping":
        await _touch_presence(user_id, db)
        await manager.send_to_user(user_id, {"t": "pong"})


async def handle_edit_message(user_id: str, data: dict, db: AsyncSession):
    message_id = data.get("m")
    new_body = data.get("b")

    if not message_id or not new_body:
        return

    msg_result = await db.execute(select(Message).where(Message.id == message_id))
    message = msg_result.scalar_one_or_none()
    if not message:
        return

    # Only sender can edit
    if message.sender_id != user_id:
        return

    # Only text messages can be edited
    if message.kind != "text":
        return

    message.body = new_body
    message.edited = True
    message.edited_at = utcnow()
    await db.commit()
    await db.refresh(message)
    # Keep the inbox preview in sync when the edited message is the last one.
    await update_conversation_preview_after_edit(db, message)

    # Serialize and broadcast
    serialized = await serialize_message(db, message, user_id)

    payload = {
        "t": "edit",
        "c": data.get("c"),
        "m": serialized.model_dump(mode="json"),
        "ts": int(message.edited_at.timestamp() * 1000),
    }

    if message.room_id:
        await manager.broadcast_to_room(message.room_id, payload)
    elif message.receiver_id:
        await manager.send_to_user(message.receiver_id, payload)
        await manager.send_to_user(user_id, payload)  # Echo back to sender


async def handle_delete_message(user_id: str, data: dict, db: AsyncSession):
    message_id = data.get("m")
    conversation_id = data.get("c")

    if not message_id:
        return

    msg_result = await db.execute(select(Message).where(Message.id == message_id))
    message = msg_result.scalar_one_or_none()
    if not message:
        return

    # Only sender can delete
    if message.sender_id != user_id:
        return

    room_id = message.room_id
    receiver_id = message.receiver_id
    await db.delete(message)
    await db.commit()

    # Re-point the denormalized last_message_* for everyone in the conversation
    # so the conversation list never shows a deleted message as its preview.
    new_last_preview = None
    if room_id:
        member_result = await db.execute(
            select(ChatRoomMember.user_id).where(ChatRoomMember.room_id == room_id)
        )
        affected = [row[0] for row in member_result.all()]
        await update_conversation_preferences_after_delete(
            db,
            conversation_type="room",
            conversation_id=room_id,
            affected_user_ids=affected,
        )
        latest = (
            await db.execute(
                select(Message)
                .options(selectinload(Message.sender))
                .where(Message.room_id == room_id)
                .order_by(Message.created_at.desc(), Message.id.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if latest:
            new_last_preview = _preview_message(latest, latest.sender)
    elif receiver_id:
        await update_conversation_preferences_after_delete(
            db,
            conversation_type="dm",
            conversation_id=receiver_id,
            partner_id=user_id,
            affected_user_ids={user_id, receiver_id},
        )
        latest = (
            await db.execute(
                select(Message)
                .options(selectinload(Message.sender))
                .where(
                    Message.room_id.is_(None),
                    or_(
                        and_(Message.sender_id == user_id, Message.receiver_id == receiver_id),
                        and_(Message.sender_id == receiver_id, Message.receiver_id == user_id),
                    ),
                )
                .order_by(Message.created_at.desc(), Message.id.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if latest:
            new_last_preview = _preview_message(latest, latest.sender)

    # Broadcast deletion
    payload = {
        "t": "delete",
        "c": conversation_id,
        "m": message_id,
        "lm": new_last_preview.model_dump(mode="json") if new_last_preview else None,
        "ts": int(utcnow().timestamp() * 1000),
    }

    if room_id:
        await manager.broadcast_to_room(room_id, payload)
    elif receiver_id:
        await manager.send_to_user(receiver_id, payload)
        await manager.send_to_user(user_id, payload)  # Echo back to sender


async def handle_send_message(user_id: str, data: dict, db: AsyncSession):
    conversation_id = data.get("c")
    message_data = data.get("m", {})
    is_e2e = data.get("e2e", False)

    # The client sends disappear_at as an ISO timestamp; store it so the
    # retention loop can actually purge the message later.
    disappear_at = None
    disappear_raw = message_data.get("disappear_at")
    if disappear_raw:
        try:
            disappear_at = datetime.fromisoformat(
                str(disappear_raw).replace("Z", "+00:00")
            )
        except (ValueError, TypeError):
            disappear_at = None

    # Create message in database
    message = Message(
        sender_id=user_id,
        receiver_id=message_data.get("receiver_id"),
        room_id=message_data.get("room_id"),
        reply_to_id=message_data.get("reply_to_id"),
        kind=message_data.get("kind", "text"),
        body=message_data.get("body"),
        attachment_url=message_data.get("attachment_url"),
        attachment_type=message_data.get("attachment_type"),
        attachment_name=message_data.get("attachment_name"),
        metadata_json=json.dumps(message_data.get("metadata")) if message_data.get("metadata") else None,
        disappear_at=disappear_at,
        # E2E fields on the message itself
        e2e_encrypted=is_e2e,
    )
    db.add(message)
    await db.flush()

    # If E2E encrypted, store the encrypted envelope
    if is_e2e:
        encrypted_msg = EncryptedMessage(
            message_id=message.id,
            sender_id=user_id,
            recipient_id=message_data.get("receiver_id"),
            ciphertext=base64.b64decode(message_data.get("e2e_ciphertext", "")),
            sender_ephemeral_public=base64.b64decode(message_data.get("e2e_sender_ephemeral", "")),
            counter=message_data.get("e2e_counter", 0),
            previous_counter=message_data.get("e2e_previous_counter"),
            session_version=message_data.get("e2e_message_version", 3),
            kind=message.kind,
            has_attachment=bool(message.attachment_url),
        )
        db.add(encrypted_msg)

    # Handle poll if present
    if message.kind == "poll" and message_data.get("poll"):
        from ..models.message import Poll, PollOption
        poll_data = message_data["poll"]
        poll = Poll(
            message_id=message.id,
            question=poll_data["question"],
            multi_choice=poll_data.get("multi_choice", False),
        )
        db.add(poll)
        await db.flush()
        for idx, label in enumerate(poll_data["options"]):
            option = PollOption(poll_id=poll.id, label=label, option_index=idx)
            db.add(option)
        await db.refresh(message)
        if message.poll:
            await db.refresh(message.poll)
            for opt in message.poll.options:
                await db.refresh(opt)

    await db.commit()
    await _touch_presence(user_id, db)

    # Mirror the HTTP send path: update denormalized conversation prefs
    # (preview, unread counts) and bring back conversations that were
    # deleted/removed from the sender's or recipients' inbox.
    await _update_conversation_preferences(db, message, user_id)

    # Expunge so the re-query reloads relationships. Explicit selectinload is
    # required because the automatic selectin default is skipped for the
    # self-referential reply_to relationship.
    db.expunge(message)
    msg_result = await db.execute(
        select(Message)
        .options(selectinload(Message.reply_to).selectinload(Message.sender))
        .where(Message.id == message.id)
    )
    message = msg_result.scalar_one()

    # Serialize message for broadcast
    serialized = await serialize_message(
        db, message, user_id, expand_sender=True, expand_reply_to=True
    )

    # Broadcast to conversation participants
    payload = {
        "t": "new_message",
        "c": conversation_id,
        "m": serialized.model_dump(mode="json"),
        "ts": int(message.created_at.timestamp() * 1000),
    }

    if message.room_id:
        await manager.broadcast_to_room(message.room_id, payload, exclude_user=user_id)
    elif message.receiver_id:
        await manager.send_to_user(message.receiver_id, payload)


async def handle_typing_start(user_id: str, data: dict):
    conversation_id = data.get("c")
    if not conversation_id:
        return
    payload = {"t": "typing", "c": conversation_id, "u": user_id}

    # Try room first; if not a room, treat as DM (conversation_id == partner user id)
    from ..models.chat_room import ChatRoom
    from ..database import async_session
    async with async_session() as db:
        room_result = await db.execute(
            select(ChatRoom).where(ChatRoom.id == conversation_id)
        )
        room = room_result.scalar_one_or_none()
        if room:
            await manager.broadcast_to_room(conversation_id, payload, exclude_user=user_id)
        else:
            # DM: conversation_id is the partner's user id. Send directly.
            await manager.send_to_user(conversation_id, payload)


async def handle_typing_stop(user_id: str, data: dict):
    conversation_id = data.get("c")
    if not conversation_id:
        return
    payload = {"t": "typing_stop", "c": conversation_id, "u": user_id}

    from ..models.chat_room import ChatRoom
    from ..database import async_session
    async with async_session() as db:
        room_result = await db.execute(
            select(ChatRoom).where(ChatRoom.id == conversation_id)
        )
        room = room_result.scalar_one_or_none()
        if room:
            await manager.broadcast_to_room(conversation_id, payload, exclude_user=user_id)
        else:
            # DM: conversation_id is the partner's user id. Send directly.
            await manager.send_to_user(conversation_id, payload)


async def handle_mark_read(user_id: str, data: dict, db: AsyncSession):
    conversation_id = data.get("c")
    message_id = data.get("m")

    # Resolve the referenced message when one is supplied.
    message = None
    if message_id:
        msg_result = await db.execute(select(Message).where(Message.id == message_id))
        message = msg_result.scalar_one_or_none()

    # Mark the specific DM message read and send the read receipt back to its
    # sender (the "double check"). Room messages keep using last_read_at.
    if message and not message.room_id and message.receiver_id == user_id and not message.read:
        message.read = True
        await db.commit()
        payload = {
            "t": "read_receipt",
            "c": conversation_id,
            "m": message.id,
            "u": user_id,
            "ts": int(utcnow().timestamp() * 1000),
        }
        if message.sender_id:
            await manager.send_to_user(message.sender_id, payload)

    # Always reset the denormalized unread counter for the conversation so the
    # badge never goes stale (this is the event that actually observes a read).
    if message and message.room_id:
        conv_type = "room"
        conv_id = message.room_id
    else:
        conv_type = "dm"
        conv_id = conversation_id or (message.sender_id if message else None)

    if conv_type and conv_id:
        pref_result = await db.execute(
            select(UserConversationPreference).where(
                and_(
                    UserConversationPreference.user_id == user_id,
                    UserConversationPreference.conversation_type == conv_type,
                    UserConversationPreference.conversation_id == str(conv_id),
                )
            )
        )
        pref = pref_result.scalar_one_or_none()
        if pref and pref.unread_count > 0:
            pref.unread_count = 0
            await db.commit()

    # Invalidate the conversations cache for this user.
    await _invalidate_user_conversations_cache(user_id)