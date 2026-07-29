"""Shared rate limiter.

Uses the real client IP from the ``X-Forwarded-For`` header when present,
because on Render the app sits behind a proxy and ``request.client.host``
would otherwise be the proxy's IP (making every user share one bucket).
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=_client_ip)
