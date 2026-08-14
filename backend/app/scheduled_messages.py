"""Scheduled message delivery loop.

Scheduled messages are stored with a future ``scheduled_at``. They are hidden
from the conversation history until ``scheduled_at`` passes, at which point
``deliver_due_scheduled_messages`` clears the flag, re-stamps ``created_at`` so
the message appears in chronological order, and broadcasts a ``new_message``
WebSocket event to the conversation participants (same payload the REST send
path emits).
"""

import asyncio

from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from .database import async_session
from .models.message import Message, Poll
from .models.user import User
from .routers.messages import serialize_message
from .services.messages.conversation_prefs import _update_conversation_preferences
from .services.messages.message_service import send_notifications_after_send
from .ws_manager import manager
from app.utils.dates import utcnow


async def deliver_due_scheduled_messages() -> int:
    """Deliver every scheduled message whose time has come.

    Returns the number of messages delivered.
    """
    now = utcnow()
    delivered = 0
    async with async_session() as db:
        rows = (
            await db.execute(
                select(Message)
                .where(
                    and_(
                        Message.scheduled_at.is_not(None),
                        Message.scheduled_at <= now,
                    )
                )
                .options(
                    selectinload(Message.sender),
                    selectinload(Message.receiver),
                    selectinload(Message.reply_to).selectinload(Message.sender),
                    selectinload(Message.poll).selectinload(Poll.options),
                    selectinload(Message.reactions),
                )
            )
        ).scalars().all()

        for message in rows:
            sender: User = message.sender
            message.scheduled_at = None
            message.created_at = now
            await db.flush()

            # Mirror the regular send path: update inbox previews/unread counts
            # and fire notifications (mentions in rooms, DM alerts).
            await _update_conversation_preferences(db, message, sender)
            await send_notifications_after_send(db, message, sender, message.receiver)

            serialized = await serialize_message(
                db, message, message.sender_id, expand_sender=True, expand_reply_to=True
            )
            payload = {
                "t": "new_message",
                "c": message.room_id or message.receiver_id,
                "m": serialized.model_dump(mode="json"),
                "ts": int(now.timestamp() * 1000),
            }

            if message.room_id:
                await manager.broadcast_to_room(
                    message.room_id, payload, exclude_user=message.sender_id
                )
            elif message.receiver_id:
                await manager.send_to_user(message.receiver_id, payload)
                await manager.send_to_user(message.sender_id, payload)
            delivered += 1

        await db.commit()

    return delivered


async def scheduled_messages_loop() -> None:
    """Background loop: deliver due scheduled messages every 30 seconds."""
    while True:
        try:
            count = await deliver_due_scheduled_messages()
            if count:
                print(f"[scheduled] delivered {count} scheduled message(s)")
        except Exception as exc:  # never let the loop die
            print(f"[scheduled] sweep failed: {exc}")
        await asyncio.sleep(30)
