"""Web Push delivery service.

The REST router (``app/routers/push.py``) manages subscriptions; this module
is the single place that actually delivers browser pushes so ``notify()`` and
friends can fire a push whenever an in-app notification is created. Delivering
is always best-effort: if VAPID keys are missing (dev) or a push fails, the
in-app notification still stands and the caller never sees an error.
"""

import json
import base64
from io import BytesIO
from typing import List, Optional, Tuple

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from webpush import WebPush, WebPushException
from webpush.types import WebPushKeys, WebPushSubscription

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization

from ..config import settings
from ..models.push_subscription import PushSubscription

# HTTP client shared by all push deliveries (connection pooling).
_HTTP = httpx.AsyncClient(timeout=10.0)


def _b64url_decode(value: str) -> bytes:
    """Decode a base64url string (no padding) into raw bytes."""
    padding = "=" * ((4 - len(value) % 4) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _vapid_to_pem(private_key: str, public_key: str) -> Tuple[bytes, bytes]:
    """Convert raw base64url VAPID keys into PEM bytes.

    The ``webpush`` library expects PEM files, but Web Push VAPID keys are
    conventionally stored as base64url (raw P-256 private key, uncompressed
    point public key). Deriving the PEM from the raw bytes avoids ever having
    to manage separate PEM files.
    """
    priv_raw = _b64url_decode(private_key)
    pub_raw = _b64url_decode(public_key)

    priv_key = ec.derive_private_key(int.from_bytes(priv_raw, "big"), ec.SECP256R1())
    pub_key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), pub_raw)

    priv_pem = priv_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    pub_pem = pub_key.public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return priv_pem, pub_pem


def get_webpush() -> Optional[WebPush]:
    if settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY:
        priv_pem, pub_pem = _vapid_to_pem(
            settings.VAPID_PRIVATE_KEY, settings.VAPID_PUBLIC_KEY
        )
        # The library prepends "mailto:" itself; strip it if already present.
        subject = settings.VAPID_SUBJECT.removeprefix("mailto:")
        return WebPush(
            private_key=BytesIO(priv_pem),
            public_key=BytesIO(pub_pem),
            subscriber=subject,
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
    if type in ("article_created", "article_updated", "article_comment", "article_comment_reply", "friend_article_comment", "article_comment_reaction"):
        return f"/news/{related_id}" if related_id else "/news"
    if type == "announcement":
        return "/news"
    if type in ("forum_reply", "forum_mention", "forum_comment_reply", "friend_forum", "forum_reaction", "forum_comment_reaction"):
        return f"/news/thread/{related_id}" if related_id else "/news"
    if type in ("zerines_received", "zerines_withdrawn"):
        return "/treasury"
    if type.startswith("pet_"):
        return "/pets"
    if type in ("post_like", "post_comment", "post_repost", "post_mention", "post_reply"):
        return f"/posts/{related_id}" if related_id else "/profile"
    if type in ("friend_request", "friend_accepted", "friend_post"):
        return f"/profile/{actor_id}" if actor_id else "/profile"
    if type in ("friend_like", "friend_comment", "friend_repost", "post_reaction", "post_comment_reaction"):
        return f"/posts/{related_id}" if related_id else "/profile"
    return "/notifications"


def _parse_subscription(sub_json: object) -> dict:
    """Subscription is stored as JSON; legacy rows may hold a Python literal."""
    if isinstance(sub_json, str):
        try:
            return json.loads(sub_json)
        except (ValueError, TypeError):
            return eval(sub_json)  # noqa: S307 - legacy literal rows
    return sub_json


async def _deliver_async(
    wp: WebPush, pairs: List[Tuple[str, object]], payload: str
) -> Tuple[int, List[str]]:
    """Async version of ``_deliver`` using the shared httpx client."""
    sent = 0
    expired: List[str] = []
    for sub_id, sub_json in pairs:
        try:
            sub = _parse_subscription(sub_json)
            endpoint = sub["endpoint"]
            keys = sub.get("keys", {})
            if not endpoint or not keys.get("p256dh") or not keys.get("auth"):
                continue

            message = wp.get(
                message=payload,
                subscription=WebPushSubscription(
                    endpoint=endpoint,
                    keys=WebPushKeys(p256dh=keys["p256dh"], auth=keys["auth"]),
                ),
            )

            resp = await _HTTP.post(
                endpoint,
                content=message.encrypted,
                headers=message.headers,
            )
            if resp.status_code in (200, 201, 202):
                sent += 1
            elif resp.status_code in (404, 410):
                expired.append(sub_id)
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
            "icon": "/icons/icon-owl.png",
            "badge": "/icons/badge-owl.png",
            "tag": tag or "nexus-notification",
            "data": {"url": url or "/notifications"},
        }
    )
    pairs = [(sub.id, sub.subscription_json) for sub in subscriptions]
    sent, expired_ids = await _deliver_async(wp, pairs, payload)

    for sub_id in expired_ids:
        sub = next((s for s in subscriptions if s.id == sub_id), None)
        if sub is not None:
            await db.delete(sub)

    return sent
