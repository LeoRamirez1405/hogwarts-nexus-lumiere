"""Web Push delivery service.

The REST router (``app/routers/push.py``) manages subscriptions; this module
is the single place that actually delivers browser pushes so ``notify()`` and
friends can fire a push whenever an in-app notification is created. Delivering
is always best-effort: if VAPID keys are missing (dev) or a push fails, the
in-app notification still stands and the caller never sees an error.
"""

import asyncio
import json
from io import BytesIO
from typing import List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from webpush import WebPush, WebPushException

from ..config import settings
from ..models.push_subscription import PushSubscription


def get_webpush() -> Optional[WebPush]:
    if settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY:
        return WebPush(
            private_key=BytesIO(settings.VAPID_PRIVATE_KEY.encode()),
            public_key=BytesIO(settings.VAPID_PUBLIC_KEY.encode()),
            subscriber=settings.VAPID_SUBJECT,
        )
    return None


def notification_url(
    type: str, related_id: Optional[str], actor_id: Optional[str]
) -> str:
    """Destination route for a notification (mirrors frontend notificationMeta).

    Kept as literal strings on purpose: importing ``N`` from
    ``notifications_service`` would create a circular import.
    """
    if type == "dm_message":
        return f"/messages?dm={related_id}" if related_id else "/messages"
    if type == "mention" and related_id and ":" in related_id:
        room_id, msg_id = related_id.split(":", 1)
        return f"/messages?room={room_id}&msg={msg_id}"
    if type in ("group_added", "group_join_request"):
        return f"/messages?room={related_id}" if related_id else "/messages"
    if type == "group_event":
        return "/messages"
    if type in ("article_created", "article_updated", "article_comment"):
        return f"/news/{related_id}" if related_id else "/news"
    if type == "announcement":
        return "/news"
    if type in ("forum_reply", "forum_mention"):
        return f"/news/thread/{related_id}" if related_id else "/news"
    if type == "zerines_received":
        return "/treasury"
    if type.startswith("pet_"):
        return "/pets"
    if type in ("post_like", "post_comment", "post_repost", "post_mention"):
        return "/profile"
    if type in ("friend_request", "friend_accepted", "friend_post"):
        return f"/profile/{actor_id}" if actor_id else "/profile"
    return "/notifications"


def _parse_subscription(sub_json: object) -> dict:
    """Subscription is stored as JSON; legacy rows may hold a Python literal."""
    if isinstance(sub_json, str):
        try:
            return json.loads(sub_json)
        except (ValueError, TypeError):
            return eval(sub_json)  # noqa: S307 - legacy literal rows
    return sub_json


def _deliver(wp: WebPush, pairs: List[Tuple[str, object]], payload: str) -> Tuple[int, List[str]]:
    """Send the payload to every subscription. Returns (sent, expired ids)."""
    sent = 0
    expired: List[str] = []
    for sub_id, sub_json in pairs:
        try:
            wp.send(subscription=_parse_subscription(sub_json), data=payload)
            sent += 1
        except WebPushException:
            expired.append(sub_id)
        except Exception:
            continue
    return sent, expired


async def send_webpush_to_user(
    db: AsyncSession,
    user_id: str,
    title: str,
    body: str,
    url: Optional[str] = None,
    tag: Optional[str] = None,
) -> int:
    """Deliver a browser push to every subscription of ``user_id``.

    Returns the number of pushes delivered. Expired subscriptions are removed
    (deleted on the caller's commit). No-op when push is not configured.
    """
    wp = get_webpush()
    if not wp:
        return 0

    result = await db.execute(
        select(PushSubscription).where(PushSubscription.user_id == user_id)
    )
    subscriptions = result.scalars().all()
    if not subscriptions:
        return 0

    payload = json.dumps(
        {
            "title": title,
            "body": body,
            "icon": "/icons/icon-192.svg",
            "badge": "/icons/icon-192.svg",
            "tag": tag or "nexus-notification",
            "data": {"url": url or "/notifications"},
        }
    )
    pairs = [(sub.id, sub.subscription_json) for sub in subscriptions]
    sent, expired_ids = await asyncio.to_thread(_deliver, wp, pairs, payload)

    for sub_id in expired_ids:
        sub = next((s for s in subscriptions if s.id == sub_id), None)
        if sub is not None:
            await db.delete(sub)

    return sent
