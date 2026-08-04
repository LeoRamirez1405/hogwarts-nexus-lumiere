"""Shared low-level helpers for the messages router package: Redis conversation
cache, attachment cleanup, keyset cursor utilities and eager-loading presets."""

import json
import re
from pathlib import Path
from typing import List, Optional

import cloudinary.uploader
import redis.asyncio as redis
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...config import settings
from ...models.message import Message, Poll, PollOption
from ...schemas.message import ConversationResponse

UPLOAD_DIR = Path("uploads")

# Redis client for caching
_redis_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(
            settings.REDIS_URL,
            max_connections=settings.REDIS_MAX_CONNECTIONS,
            decode_responses=True,
            socket_timeout=None,
            socket_connect_timeout=10,
        )
    return _redis_client


async def _close_redis():
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        _redis_client = None


async def _get_cached_conversations(user_id: str) -> List[ConversationResponse] | None:
    """Get cached conversations from Redis."""
    r = get_redis()
    try:
        cached = await r.get(f"conv:{user_id}")
        if cached:
            return [ConversationResponse.model_validate_json(item) for item in json.loads(cached)]
    except Exception:
        pass
    return None


async def _set_cached_conversations(user_id: str, conversations: List[ConversationResponse]) -> None:
    """Cache conversations in Redis with TTL 30s."""
    r = get_redis()
    try:
        data = json.dumps([c.model_dump(mode="json") for c in conversations])
        await r.setex(f"conv:{user_id}", 30, data)
    except Exception:
        pass


async def _invalidate_conversations_cache(user_id: str) -> None:
    """Invalidate conversations cache for a user."""
    r = get_redis()
    try:
        await r.delete(f"conv:{user_id}")
    except Exception:
        pass


async def _invalidate_conversations_caches(user_ids: List[str]) -> None:
    """Invalidate conversations cache for multiple users."""
    if not user_ids:
        return
    r = get_redis()
    try:
        keys = [f"conv:{uid}" for uid in user_ids]
        await r.delete(*keys)
    except Exception:
        pass


def _delete_attachment_file(attachment_url: Optional[str]) -> None:
    """Best-effort removal of an uploaded file referenced by a message.

    Handles both local file paths (for backward compatibility) and Cloudinary URLs.
    """
    if not attachment_url:
        return

    # Handle local file paths (backward compatibility)
    if attachment_url.startswith("http://localhost:8000/uploads/") or \
       attachment_url.startswith("/uploads/"):
        # Extract filename from URL
        if attachment_url.startswith("http://localhost:8000/uploads/"):
            filename = attachment_url[len("http://localhost:8000/uploads/"):]
        else:  # starts with /uploads/
            filename = attachment_url[len("/uploads/"):]

        if not filename:
            return

        filepath = UPLOAD_DIR / filename
        try:
            if filepath.exists() and filepath.is_file():
                filepath.unlink()
        except OSError:
            pass

    # Handle Cloudinary URLs
    elif "res.cloudinary.com" in attachment_url:
        try:
            # Extract public_id from Cloudinary URL
            # Format: https://res.cloudinary.com/<cloud_name>/image/upload/v1234567890/public_id.extension
            # or: https://res.cloudinary.com/<cloud_name>/<resource_type>/<upload_type>/v1234567890/public_id.extension
            # Match pattern: /<resource_type>/<upload_type>/v<timestamp>/<public_id>.<extension>
            # or: /<resource_type>/<upload_type>/<public_id>.<extension>
            match = re.search(r'/([^/]+/[^/]+/v\d+_/)?([^/]+?)\.[^/]+$', attachment_url)
            if match:
                public_id = match.group(2)  # The public_id part
                # Full public_id includes the folder prefix
                full_public_id = f"nexus_uploads/{public_id}"

                # Delete from Cloudinary
                cloudinary.uploader.destroy(full_public_id, resource_type="auto")
        except Exception:
            # Best effort - don't fail the retention sweep if Cloudinary deletion fails
            pass


async def _resolve_cursor(db: AsyncSession, before: Optional[str]):
    """Turn a `before` message id into a (created_at, id) keyset cursor.

    Returns None when there is no cursor (initial load) or the referenced
    message no longer exists (e.g. it was purged) — callers then just return
    the newest page.
    """
    if not before:
        return None
    row = (
        await db.execute(
            select(Message.created_at, Message.id).where(Message.id == before)
        )
    ).first()
    return row  # (created_at, id) or None


def _older_than(cursor):
    """Keyset predicate: strictly older than the cursor (created_at, id)."""
    created_at, mid = cursor
    return or_(
        Message.created_at < created_at,
        and_(Message.created_at == created_at, Message.id < mid),
    )


_ROOM_MSG_OPTS = (
    selectinload(Message.sender),
    selectinload(Message.poll).selectinload(Poll.options).selectinload(PollOption.votes),
    selectinload(Message.reply_to).selectinload(Message.sender),
    selectinload(Message.reactions),
)

# On the initial load we expand the page so the unread divider (plus a little
# read context above it) is included and every unread message is visible below
# it — the client then lazy-loads older read history upward. Capped so a huge
# backlog never triggers a giant single query.
INITIAL_UNREAD_CONTEXT = 10
INITIAL_MAX = 100


def _initial_limit(limit: int, unread_count: int, has_first_unread: bool) -> int:
    """Widen the first page to cover all unread messages + some context."""
    if not has_first_unread or unread_count <= 0:
        return limit
    return min(max(limit, unread_count + INITIAL_UNREAD_CONTEXT), INITIAL_MAX)


_PIN_OPTS = (
    selectinload(Message.sender),
    selectinload(Message.receiver),
    selectinload(Message.poll).selectinload(Poll.options).selectinload(PollOption.votes),
    selectinload(Message.reply_to).selectinload(Message.sender),
    selectinload(Message.reactions),
)
