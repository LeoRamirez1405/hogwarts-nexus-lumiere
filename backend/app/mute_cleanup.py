"""
Mute cleanup scheduler
Runs every hour to clear expired ``muted_until`` timestamps so stale rows
don't linger forever in ``UserConversationPreference`` / ``ChatRoomMember``.
"""

import asyncio
from datetime import datetime

from sqlalchemy import and_, select

from .database import async_session
from .models.chat_room import ChatRoomMember, UserConversationPreference


async def mute_cleanup_loop():
    """Background task that clears expired mutes every hour."""
    while True:
        try:
            await _cleanup_expired_mutes()
        except Exception as e:
            print(f"Error in mute_cleanup_loop: {e}")

        await asyncio.sleep(3600)  # Every hour


async def _cleanup_expired_mutes():
    """Set muted_until = None for every mute that has already expired."""
    async with async_session() as db:
        now = datetime.utcnow()

        prefs_result = await db.execute(
            select(UserConversationPreference).where(
                and_(
                    UserConversationPreference.muted_until.is_not(None),
                    UserConversationPreference.muted_until <= now,
                )
            )
        )
        for pref in prefs_result.scalars().all():
            pref.muted_until = None

        members_result = await db.execute(
            select(ChatRoomMember).where(
                and_(
                    ChatRoomMember.muted_until.is_not(None),
                    ChatRoomMember.muted_until <= now,
                )
            )
        )
        for member in members_result.scalars().all():
            member.muted_until = None

        await db.commit()
