"""Central notification helpers.

One generic ``Notification`` table (``models/article_subscription.py``) backs every
kind of in-app alert. This module is the single place that knows how to create
them so routers stay thin and consistent:

- ``N`` — the catalog of notification ``type`` strings.
- ``notify`` — create one notification (skips self-notification).
- ``notify_like`` — like alerts, aggregated so rapid likes don't spam the author.
- ``notify_all_users`` — broadcast (new article, new announcement).
- ``resolve_mentions`` — turn an "@Name" body into the mentioned ``User`` rows.

Helpers only *add* to the session; the calling router is responsible for
``commit`` (it usually already commits its own writes in the same transaction).
"""

from typing import Optional

from sqlalchemy import select, func, insert, literal, String, true
from sqlalchemy.ext.asyncio import AsyncSession

from .models.article_subscription import Notification
from .models.user import User
from .models.post import PostLike
# Re-exported for backwards compatibility: articles/forum/posts still import
# `resolve_mentions` from this module.
from .services.mentions import resolve_mentions  # noqa: F401
from .services.push_service import notification_url, send_webpush_to_user
from .ws_manager import manager


class N:
    """Catalog of notification type strings (kept in one place)."""

    # Social / posts
    POST_LIKE = "post_like"
    POST_COMMENT = "post_comment"
    POST_REPOST = "post_repost"
    POST_MENTION = "post_mention"
    POST_REPLY = "post_reply"
    # Reactions (emoji)
    POST_REACTION = "post_reaction"
    POST_COMMENT_REACTION = "post_comment_reaction"
    FORUM_REACTION = "forum_reaction"
    FORUM_COMMENT_REACTION = "forum_comment_reaction"
    ARTICLE_COMMENT_REACTION = "article_comment_reaction"
    # Messaging
    DM_MESSAGE = "dm_message"
    MENTION = "mention"  # existing: mention inside a chat room
    GROUP_ADDED = "group_added"
    GROUP_JOIN_REQUEST = "group_join_request"
    GROUP_EVENT = "group_event"  # events in chat rooms (created, cancelled, RSVP, reminder)
    # Press / articles / forum
    ARTICLE_CREATED = "article_created"
    ARTICLE_UPDATED = "article_updated"
    ARTICLE_COMMENT = "article_comment"
    ARTICLE_COMMENT_REPLY = "article_comment_reply"
    FORUM_REPLY = "forum_reply"
    FORUM_MENTION = "forum_mention"
    FORUM_COMMENT_REPLY = "forum_comment_reply"
    # Economy
    ZERINES_RECEIVED = "zerines_received"
    INVENTORY_CONSUMED = "inventory_consumed"
    # Social graph
    FRIEND_REQUEST = "friend_request"
    FRIEND_ACCEPTED = "friend_accepted"
    # Friend activity (public things your friends do, seen from your feed)
    FRIEND_LIKE = "friend_like"
    FRIEND_COMMENT = "friend_comment"
    FRIEND_REPOST = "friend_repost"
    FRIEND_FORUM = "friend_forum"
    FRIEND_ARTICLE_COMMENT = "friend_article_comment"
    # Pets
    PET_NEEDS_ATTENTION = "pet_needs_attention"
    PET_ESCAPE_WARNING = "pet_escape_warning"
    PET_ESCAPED = "pet_escaped"
    PET_AGING = "pet_aging"
    PET_FAREWELL = "pet_farewell"
    PET_SOLD = "pet_sold"
    # Broadcast
    ANNOUNCEMENT = "announcement"
    FRIEND_POST = "friend_post"
    # Marketplace purchase (admin notification)
    MARKETPLACE_PURCHASE = "marketplace_purchase"
    MARKETPLACE_PURCHASE_FLOURISH = "marketplace_purchase_flourish"
    MARKETPLACE_PURCHASE_BORGIN = "marketplace_purchase_borgin"


def _notification_payload(n: Notification) -> dict:
    """Shape a Notification row into the WS push payload (mirrors the REST
    ``NotificationResponse`` fields so the client can prepend it directly)."""
    return {
        "id": n.id,
        "user_id": n.user_id,
        "type": n.type,
        "title": n.title,
        "body": n.body,
        "related_id": n.related_id,
        "actor_id": n.actor_id,
        "read": bool(n.read),
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


async def _push_notification(n: Notification) -> None:
    """Best-effort realtime push of a single notification to its recipient."""
    try:
        payload = _notification_payload(n)
        await manager.send_to_user(
            n.user_id,
            {"t": "notification", "n": payload},
        )
    except Exception:
        pass


async def notify(
    db: AsyncSession,
    *,
    user_id: str,
    type: str,
    title: str,
    body: str,
    related_id: Optional[str] = None,
    actor_id: Optional[str] = None,
    force: bool = False,
) -> Optional[Notification]:
    """Create a notification for ``user_id``. No-op (returns None) when the
    recipient is also the actor — you never get notified about your own action.
    Pass ``force=True`` to override (e.g., admin actions on own inventory)."""
    if not force and actor_id is not None and actor_id == user_id:
        return None
    n = Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        related_id=related_id,
        actor_id=actor_id,
        read=False,
    )
    db.add(n)
    # Materialize id/created_at so the realtime WS push carries a full row.
    await db.flush()
    await _push_notification(n)
    # Browser push (best-effort) so the user is alerted even with the app closed.
    try:
        await send_webpush_to_user(
            db,
            user_id=user_id,
            title=title,
            body=body,
            url=notification_url(type, related_id, actor_id),
        )
    except Exception:
        pass
    return n


async def notify_like(db: AsyncSession, post, actor: User) -> Optional[Notification]:
    """Notify a post's author that someone liked it, aggregating rapid likes.

    If an unread ``post_like`` notification for this post already exists we
    refresh it in place ("A Fulano y N mas les gusto tu publicacion") instead of
    stacking a new row every time someone taps the heart.
    """
    if post.author_id == actor.id:
        return None

    likes_count = (
        await db.execute(
            select(func.count(PostLike.post_id)).where(PostLike.post_id == post.id)
        )
    ).scalar() or 0

    if likes_count <= 1:
        title = f"A {actor.name} le gusto tu publicacion"
    else:
        title = f"A {actor.name} y {likes_count - 1} mas les gusto tu publicacion"
    body = post.body[:140] if post.body else "Tu publicacion"

    existing = (
        await db.execute(
            select(Notification).where(
                Notification.user_id == post.author_id,
                Notification.type == N.POST_LIKE,
                Notification.related_id == post.id,
                Notification.read.is_(False),
            )
        )
    ).scalar_one_or_none()

    if existing:
        from datetime import datetime

        existing.title = title
        existing.body = body
        existing.actor_id = actor.id
        existing.created_at = datetime.utcnow()
        await db.flush()
        await _push_notification(existing)
        # Browser push for the aggregated like (best-effort).
        try:
            await send_webpush_to_user(
                db,
                user_id=post.author_id,
                title=existing.title,
                body=existing.body,
                url=notification_url(N.POST_LIKE, post.id, actor.id),
            )
        except Exception:
            pass
        return existing

    return await notify(
        db,
        user_id=post.author_id,
        type=N.POST_LIKE,
        title=title,
        body=body,
        related_id=post.id,
        actor_id=actor.id,
    )


async def notify_all_users(
    db: AsyncSession,
    *,
    type: str,
    title: str,
    body: str,
    related_id: Optional[str] = None,
    exclude_id: Optional[str] = None,
) -> int:
    """Broadcast a notification to every user except ``exclude_id`` (the author).

    Uses a single ``INSERT INTO notifications ... SELECT`` statement instead of
    the old per-user loop, so it scales to thousands of recipients without
    thousands of round-trips or ORM objects in memory.

    Also sends Web Push notifications (best-effort) so users receive alerts
    even with the app closed/installed as PWA.
    """
    from datetime import datetime
    import asyncio

    from .models.push_subscription import PushSubscription

    dialect = getattr(getattr(db, "bind", None), "dialect", None)
    if dialect is not None and dialect.name == "postgresql":
        id_expr = func.gen_random_uuid().cast(String)
    else:
        id_expr = func.lower(func.hex(func.randomblob(16)))

    # Bound value instead of CURRENT_TIMESTAMP() (a syntax error on SQLite).
    now = datetime.utcnow()

    # ``exclude_id`` is a plain value (str/int or None), not a SQL expression, so
    # build the WHERE clause conditionally instead of calling .is_() on it.
    where_cond = (User.id != exclude_id) if exclude_id is not None else true()
    stmt = (
        insert(Notification)
        .from_select(
            ["id", "user_id", "type", "title", "body", "related_id", "actor_id", "read", "created_at"],
            select(
                id_expr.label("id"),
                User.id.label("user_id"),
                literal(type).label("type"),
                literal(title).label("title"),
                literal(body).label("body"),
                literal(related_id).label("related_id"),
                literal(exclude_id).label("actor_id"),
                literal("false").label("read"),
                literal(now).label("created_at"),
            ).where(where_cond),
        )
    )
    result = await db.execute(stmt)
    count = result.rowcount or 0

    # Best-effort realtime nudge to every currently-online user so the bell
    # updates without waiting for the next REST poll.
    online = manager.get_online_users()
    for uid in online:
        if uid != exclude_id:
            await manager.send_to_user(uid, {"t": "notification_refresh"})

    # Best-effort Web Push for offline/installed-PWA users.
    # Fetch user_ids that were notified (excluding exclude_id) to target push.
    if count > 0:
        try:
            # Get the user_ids that received the notification
            user_ids_stmt = select(User.id).where(where_cond)
            user_ids_result = await db.execute(user_ids_stmt)
            notified_user_ids = [row[0] for row in user_ids_result.all()]

            if notified_user_ids:
                # Fetch all push subscriptions for these users in one query
                subs_stmt = select(PushSubscription).where(
                    PushSubscription.user_id.in_(notified_user_ids)
                )
                subs_result = await db.execute(subs_stmt)
                subscriptions = subs_result.scalars().all()

                if subscriptions:
                    # Group subscriptions by user_id
                    from collections import defaultdict
                    subs_by_user: dict[str, list] = defaultdict(list)
                    for sub in subscriptions:
                        subs_by_user[sub.user_id].append(sub)

                    # Send WebPush in batches to avoid overwhelming the push service
                    url = notification_url(type, related_id, exclude_id)
                    batch_size = 50
                    semaphore = asyncio.Semaphore(10)  # Limit concurrent sends

                    async def send_to_user_batch(user_id: str, user_subs: list):
                        async with semaphore:
                            try:
                                # Use existing send_webpush_to_user logic but with pre-fetched subs
                                from .services.push_service import get_webpush, _parse_subscription
                                import json

                                wp = get_webpush()
                                if not wp:
                                    return 0

                                payload = json.dumps(
                                    {
                                        "title": title,
                                        "body": body,
                                        "icon": "/icons/icon-192-owl-outline.svg",
                                        "badge": "/icons/icon-192-owl-outline.svg",
                                        "tag": f"nexus-broadcast-{type}",
                                        "data": {"url": url or "/notifications"},
                                    }
                                )

                                pairs = [(sub.id, sub.subscription_json) for sub in user_subs]
                                sent = 0
                                expired_ids = []
                                for sub_id, sub_json in pairs:
                                    try:
                                        wp.send(subscription=_parse_subscription(sub_json), data=payload)
                                        sent += 1
                                    except Exception:
                                        expired_ids.append(sub_id)

                                # Clean up expired subscriptions
                                for sub_id in expired_ids:
                                    sub = next((s for s in user_subs if s.id == sub_id), None)
                                    if sub is not None:
                                        await db.delete(sub)

                                return sent
                            except Exception:
                                return 0

                    # Process in batches
                    user_items = list(subs_by_user.items())
                    for i in range(0, len(user_items), batch_size):
                        batch = user_items[i : i + batch_size]
                        await asyncio.gather(
                            *[send_to_user_batch(uid, subs) for uid, subs in batch],
                            return_exceptions=True,
                        )
                        # Small delay between batches to be nice to push services
                        if i + batch_size < len(user_items):
                            await asyncio.sleep(0.1)

        except Exception:
            # Best-effort: never let push failures break the main notification flow
            pass

    return count


async def notify_friends_of_post(
    db: AsyncSession, post, actor: User
) -> int:
    """Notify all friends of the post author about the new post."""
    from .services.friend_notifications import friend_ids_of

    friend_ids = await friend_ids_of(db, actor.id)
    friend_ids.discard(actor.id)

    count = 0
    body = (post.body or "")[:140]
    for fid in friend_ids:
        if fid == actor.id:
            continue
        n = Notification(
            user_id=fid,
            type=N.FRIEND_POST,
            title=f"{actor.name} publicó algo nuevo",
            body=body,
            related_id=post.id,
            actor_id=actor.id,
            read=False,
        )
        db.add(n)
        await db.flush()
        await _push_notification(n)
        # Browser push for the friend's new post (best-effort).
        try:
            await send_webpush_to_user(
                db,
                user_id=fid,
                title=f"{actor.name} publicó algo nuevo",
                body=body,
                url=notification_url(N.FRIEND_POST, post.id, actor.id),
            )
        except Exception:
            pass
        count += 1
    return count
