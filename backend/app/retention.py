"""Message retention and expiry sweeps.

- ``retention_loop``: periodically delete old messages (skipping pinned).
- ``disappearing_loop``: periodically delete messages whose ``disappear_at`` has passed.
"""

import asyncio
from datetime import datetime, timedelta

from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from .database import async_session
from .config import settings
from .models.message import Message
from .routers.messages import _delete_attachment_file


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
                        Message.pinned == False,  # noqa: E712
                    )
                )
                .options(
                    selectinload(Message.poll),
                    selectinload(Message.reactions),
                )
            )
        ).scalars().all()

        for m in rows:
            _delete_attachment_file(m.attachment_url)
            await db.delete(m)  # ORM delete cascades poll/options/votes/reactions
            deleted += 1

        await db.commit()

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

        for m in rows:
            _delete_attachment_file(m.attachment_url)
            await db.delete(m)
            deleted += 1

        await db.commit()

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

