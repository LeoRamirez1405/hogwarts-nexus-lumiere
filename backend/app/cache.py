"""Small in-process TTL cache for read-heavy GET endpoints.

Render Free runs a single uvicorn worker, so a plain process-local dict is a
safe and effective cache. Data is keyed by request path (and query string for
paginated endpoints); per-user data uses a user-scoped key (e.g.
"dashboard:user:<id>"). Admin edits become visible once the TTL expires.

This is a stop-gap for the free tier: when Redis is provisioned, swap these
helpers for redis.get/set with the same TTLs.
"""

import time
from typing import Any, Awaitable, Callable, Optional

_entries: dict[str, tuple[float, Any]] = {}
_MAX_ENTRIES = 512


def cache_get(key: str) -> Optional[Any]:
    entry = _entries.get(key)
    if entry is None:
        return None
    expires_at, value = entry
    if expires_at <= time.monotonic():
        _entries.pop(key, None)
        return None
    return value


def cache_set(key: str, value: Any, ttl: float) -> None:
    _entries[key] = (time.monotonic() + ttl, value)
    if len(_entries) > _MAX_ENTRIES:
        # Evict the oldest quarter of entries to bound memory.
        for old_key in list(_entries)[: _MAX_ENTRIES // 4]:
            _entries.pop(old_key, None)


def cache_clear_prefix(prefix: str) -> None:
    for key in list(_entries):
        if key.startswith(prefix):
            _entries.pop(key, None)


async def cache_or_set(
    key: str, ttl: float, producer: Callable[[], Awaitable[Any]]
) -> Any:
    cached = cache_get(key)
    if cached is not None:
        return cached
    value = await producer()
    cache_set(key, value, ttl)
    return value
