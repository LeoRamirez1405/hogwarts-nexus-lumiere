"""Message retention and expiry sweeps.

- ``retention_loop``: periodically delete old messages (skipping pinned).
- ``disappearing_loop``: periodically delete messages whose ``disappear_at`` has passed.
"""

import asyncio
from datetime import datetime, timedelta
from typing import List

from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload

from .database import async_session
from .config import settings
from .models.message import Message
from .routers.messages import _delete_attachment_file
from .routers.messages.serializers.message import _preview_message
from .services.messages.conversation_prefs import update_conversation_preferences_after_delete
from .ws_manager import manager


async def _broadcast_purged_messages(db, rows: List[Message]) -> None:
    """Notify connected clients that messages were purged by a sweep.

    Mirrors the delete endpoint's WS payload (``t=delete`` + ``lm``) so inbox
    previews and open chats heal in real time after retention/disappearing
    sweeps — otherwise a client would keep showing a purged message as its
    conversation preview until the next full re-fetch.
    """
    if not rows:
        return

    room_ids = sorted({m.room_id for m in rows if m.room_id})
    dm_pairs = sorted(
        {
            (a, b)
            for m in rows
            if not m.room_id and m.sender_id and m.receiver_id
            for a, b in [(m.sender_id, m.receiver_id)]
        }
    )

    room_previews = {}
    for room_id in room_ids:
        latest = (
            await db.execute(
                select(Message)
                .options(selectinload(Message.sender))
                .where(Message.room_id == room_id)
                .order_by(Message.created_at.desc(), Message.id.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        room_previews[room_id] = (
            _preview_message(latest, latest.sender).model_dump(mode="json")
            if latest
            else None
        )

    dm_previews = {}
    for a, b in dm_pairs:
        latest = (
            await db.execute(
                select(Message)
                .options(selectinload(Message.sender))
                .where(
                    Message.room_id.is_(None),
                    or_(
                        and_(Message.sender_id == a, Message.receiver_id == b),
                        and_(Message.sender_id == b, Message.receiver_id == a),
                    ),
                )
                .order_by(Message.created_at.desc(), Message.id.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        dm_previews[(a, b)] = (
            _preview_message(latest, latest.sender).model_dump(mode="json")
            if latest
            else None
        )

    ts = int(datetime.utcnow().timestamp() * 1000)
    for m in rows:
        if m.room_id:
            await manager.broadcast_to_room(
                m.room_id,
                {"t": "delete", "c": m.room_id, "m": m.id, "lm": room_previews[m.room_id], "ts": ts},
            )
        elif m.sender_id and m.receiver_id:
            preview = dm_previews[(m.sender_id, m.receiver_id)]
            await manager.send_to_user(
                m.sender_id,
                {"t": "delete", "c": m.receiver_id, "m": m.id, "lm": preview, "ts": ts},
            )
            await manager.send_to_user(
                m.receiver_id,
                {"t": "delete", "c": m.sender_id, "m": m.id, "lm": preview, "ts": ts},
            )


async def purge_old_messages(days: int) -> dict:
    """Delete non-pinned messages older than ``days`` and their files.

    Returns a small summary dict. A ``days`` of 0 (or less) is a no-op.
    """
    if days <= 0:
        return {"deleted": 0, "disabled": True}

    cutoff = datetime.utcnow() - timedelta(days=days)
    deleted = 0
    async with async_session() as db:
        rows = (
            await db.execute(
                select(Message)
                .where(
                    and_(
                        Message.created_at < cutoff,
                        Message.pinned.is_(False),
                    )
                )
                .options(
                    selectinload(Message.poll),
                    selectinload(Message.reactions),
                )
            )
        ).scalars().all()

        # Group affected conversations before deleting so last_message_* can be
        # re-pointed to the surviving latest message afterwards.
        dm_convs: set[tuple[str, str]] = set()  # (partner_id, user_id)
        room_ids: set[str] = set()
        for m in rows:
            if m.room_id:
                room_ids.add(m.room_id)
            else:
                if m.sender_id and m.receiver_id:
                    dm_convs.add((m.sender_id, m.receiver_id))

        for m in rows:
            _delete_attachment_file(m.attachment_url)
            await db.delete(m)  # ORM delete cascades poll/options/votes/reactions
            deleted += 1

        await db.commit()

        for room_id in room_ids:
            try:
                await update_conversation_preferences_after_delete(
                    db,
                    conversation_type="room",
                    conversation_id=room_id,
                )
            except Exception as exc:
                print(f"[retention] pref heal failed for room {room_id}: {exc}")
        for a, b in dm_convs:
            try:
                await update_conversation_preferences_after_delete(
                    db,
                    conversation_type="dm",
                    conversation_id=b,
                    partner_id=a,
                    affected_user_ids={a, b},
                )
            except Exception as exc:
                print(f"[retention] pref heal failed for dm {a}-{b}: {exc}")

        await _broadcast_purged_messages(db, rows)

    return {"deleted": deleted, "cutoff": cutoff.isoformat()}


async def retention_loop() -> None:
    """Background loop: sweep retention now, then every ``RETENTION_SWEEP_HOURS``."""
    if settings.MESSAGE_RETENTION_DAYS <= 0:
        return
    interval = max(1, settings.RETENTION_SWEEP_HOURS) * 3600
    while True:
        try:
            result = await purge_old_messages(settings.MESSAGE_RETENTION_DAYS)
            if result.get("deleted"):
                print(f"[retention] purged {result['deleted']} old messages")
        except Exception as exc:  # never let the loop die
            print(f"[retention] sweep failed: {exc}")
        await asyncio.sleep(interval)


async def purge_expired_disappearing() -> dict:
    """Delete messages whose ``disappear_at`` timestamp has passed."""
    now = datetime.utcnow()
    deleted = 0
    async with async_session() as db:
        rows = (
            await db.execute(
                select(Message)
                .where(
                    and_(
                        Message.disappear_at.is_not(None),
                        Message.disappear_at <= now,
                    )
                )
                .options(
                    selectinload(Message.poll),
                    selectinload(Message.reactions),
                )
            )
        ).scalars().all()

        dm_convs: set[tuple[str, str]] = set()
        room_ids: set[str] = set()
        for m in rows:
            if m.room_id:
                room_ids.add(m.room_id)
            else:
                if m.sender_id and m.receiver_id:
                    dm_convs.add((m.sender_id, m.receiver_id))

        for m in rows:
            _delete_attachment_file(m.attachment_url)
            await db.delete(m)
            deleted += 1

        await db.commit()

        for room_id in room_ids:
            try:
                await update_conversation_preferences_after_delete(
                    db,
                    conversation_type="room",
                    conversation_id=room_id,
                )
            except Exception as exc:
                print(f"[disappearing] pref heal failed for room {room_id}: {exc}")
        for a, b in dm_convs:
            try:
                await update_conversation_preferences_after_delete(
                    db,
                    conversation_type="dm",
                    conversation_id=b,
                    partner_id=a,
                    affected_user_ids={a, b},
                )
            except Exception as exc:
                print(f"[disappearing] pref heal failed for dm {a}-{b}: {exc}")

        await _broadcast_purged_messages(db, rows)

    return {"deleted": deleted, "cutoff": now.isoformat()}


async def disappearing_loop() -> None:
    """Background loop: sweep expired disappearing messages every 60 seconds."""
    while True:
        try:
            result = await purge_expired_disappearing()
            if result.get("deleted"):
                print(f"[disappearing] purged {result['deleted']} expired messages")
        except Exception as exc:  # never let the loop die
            print(f"[disappearing] sweep failed: {exc}")
        await asyncio.sleep(60)

