"""Message retention: periodically delete old messages and their uploaded
attachments, keeping pinned messages forever.

Text rows are tiny; the real disk cost is the files under ``uploads/``. This
sweep removes both: it deletes messages older than
``settings.MESSAGE_RETENTION_DAYS`` (skipping pinned ones) and unlinks any
attachment file they referenced. Set the setting to 0 to disable.
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


async def retention_loop():
    """Background loop: sweep now, then every ``RETENTION_SWEEP_HOURS``."""
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
