import json
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models.message import Message
from ..models.chat_room import ChatRoomMember, UserConversationPreference
from ..middleware.auth import get_current_user_ws
from ..ws_manager import manager
from .messages import serialize_message

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
        )
        await r.delete(f"conv:{user_id}")
        await r.close()
    except Exception:
        pass


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    current_user = await get_current_user_ws(token, db)
    if not current_user:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await manager.connect(current_user.id, websocket)

    # Add user to their rooms
    room_result = await db.execute(
        select(ChatRoomMember.room_id).where(ChatRoomMember.user_id == current_user.id)
    )
    for (room_id,) in room_result.all():
        manager.add_user_to_room(current_user.id, room_id)

    # Broadcast presence online
    online_payload = {"t": "presence", "u": current_user.id, "s": "online"}
    for room_id in manager.user_rooms.get(current_user.id, set()):
        await manager.broadcast_to_room(room_id, online_payload, exclude_user=current_user.id)

    try:
        while True:
            data = await websocket.receive_json()
            await handle_ws_message(current_user.id, data, db)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        # Broadcast presence offline
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
    message.edited_at = datetime.utcnow()
    await db.commit()
    await db.refresh(message)

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

    await db.delete(message)
    await db.commit()

    # Broadcast deletion
    payload = {
        "t": "delete",
        "c": conversation_id,
        "m": message_id,
        "ts": int(datetime.utcnow().timestamp() * 1000),
    }

    if message.room_id:
        await manager.broadcast_to_room(message.room_id, payload)
    elif message.receiver_id:
        await manager.send_to_user(message.receiver_id, payload)
        await manager.send_to_user(user_id, payload)  # Echo back to sender


async def handle_send_message(user_id: str, data: dict, db: AsyncSession):
    conversation_id = data.get("c")
    message_data = data.get("m", {})

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
    )
    db.add(message)
    await db.flush()

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
    payload = {"t": "typing", "c": conversation_id, "u": user_id}

    # Get the room to broadcast typing indicator
    if conversation_id:
        # Check if it's a room
        from ..models.chat_room import ChatRoom
        from ..database import async_session
        async with async_session() as db:
            room_result = await db.execute(
                select(ChatRoom).where(ChatRoom.id == conversation_id)
            )
            room = room_result.scalar_one_or_none()
            if room:
                await manager.broadcast_to_room(conversation_id, payload, exclude_user=user_id)


async def handle_typing_stop(user_id: str, data: dict):
    conversation_id = data.get("c")
    payload = {"t": "typing_stop", "c": conversation_id, "u": user_id}

    if conversation_id:
        from ..models.chat_room import ChatRoom
        from ..database import async_session
        async with async_session() as db:
            room_result = await db.execute(
                select(ChatRoom).where(ChatRoom.id == conversation_id)
            )
            room = room_result.scalar_one_or_none()
            if room:
                await manager.broadcast_to_room(conversation_id, payload, exclude_user=user_id)


async def handle_mark_read(user_id: str, data: dict, db: AsyncSession):
    conversation_id = data.get("c")
    message_id = data.get("m")

    if not conversation_id or not message_id:
        return

    # Mark message as read
    msg_result = await db.execute(
        select(Message).where(Message.id == message_id)
    )
    message = msg_result.scalar_one_or_none()
    if message and message.receiver_id == user_id and not message.read:
        message.read = True
        await db.commit()

        # Reset unread_count in conversation preference
        conv_type = "room" if message.room_id else "dm"
        conv_id = message.room_id if message.room_id else message.sender_id
        if conv_id:
            pref_result = await db.execute(
                select(UserConversationPreference).where(
                    and_(
                        UserConversationPreference.user_id == user_id,
                        UserConversationPreference.conversation_type == conv_type,
                        UserConversationPreference.conversation_id == conv_id,
                    )
                )
            )
            pref = pref_result.scalar_one_or_none()
            if pref:
                pref.unread_count = 0
                await db.commit()

        # Invalidate conversations cache for this user
        await _invalidate_user_conversations_cache(user_id)

        # Broadcast read receipt
        payload = {
            "t": "read_receipt",
            "c": conversation_id,
            "m": message_id,
            "u": user_id,
            "ts": int(message.created_at.timestamp() * 1000),
        }

        if message.room_id:
            await manager.broadcast_to_room(message.room_id, payload)
        elif message.sender_id:
            await manager.send_to_user(message.sender_id, payload)