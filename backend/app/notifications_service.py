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

import re
from typing import List, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from .models.article_subscription import Notification
from .models.user import User
from .models.post import PostLike


class N:
    """Catalog of notification type strings (kept in one place)."""

    # Social / posts
    POST_LIKE = "post_like"
    POST_COMMENT = "post_comment"
    POST_REPOST = "post_repost"
    POST_MENTION = "post_mention"
    # Messaging
    DM_MESSAGE = "dm_message"
    MENTION = "mention"  # existing: mention inside a chat room
    GROUP_ADDED = "group_added"
    # Press / articles / forum
    ARTICLE_CREATED = "article_created"
    ARTICLE_UPDATED = "article_updated"
    ARTICLE_COMMENT = "article_comment"
    FORUM_REPLY = "forum_reply"
    FORUM_MENTION = "forum_mention"
    # Economy
    ZERINES_RECEIVED = "zerines_received"
    # Social graph
    FRIEND_REQUEST = "friend_request"
    FRIEND_ACCEPTED = "friend_accepted"
    # Pets
    PET_NEEDS_ATTENTION = "pet_needs_attention"
    PET_AGING = "pet_aging"
    PET_FAREWELL = "pet_farewell"
    PET_SOLD = "pet_sold"
    # Broadcast
    ANNOUNCEMENT = "announcement"


async def notify(
    db: AsyncSession,
    *,
    user_id: str,
    type: str,
    title: str,
    body: str,
    related_id: Optional[str] = None,
    actor_id: Optional[str] = None,
) -> Optional[Notification]:
    """Create a notification for ``user_id``. No-op (returns None) when the
    recipient is also the actor — you never get notified about your own action."""
    if actor_id is not None and actor_id == user_id:
        return None
    n = Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        related_id=related_id,
        actor_id=actor_id,
        read="false",
    )
    db.add(n)
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
                Notification.read == "false",
            )
        )
    ).scalar_one_or_none()

    if existing:
        from datetime import datetime

        existing.title = title
        existing.body = body
        existing.actor_id = actor.id
        existing.created_at = datetime.utcnow()
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
    """Broadcast a notification to every user except ``exclude_id`` (the author)."""
    user_ids = (await db.execute(select(User.id))).scalars().all()
    count = 0
    for uid in user_ids:
        if uid == exclude_id:
            continue
        db.add(
            Notification(
                user_id=uid,
                type=type,
                title=title,
                body=body,
                related_id=related_id,
                actor_id=exclude_id,
                read="false",
            )
        )
        count += 1
    return count


# Names can be multi-word and the text after an "@" usually keeps going
# ("@Hermione Granger mira esto"), so we can't match the phrase whole. For every
# "@<phrase>" we pick the longest real user name that is a prefix of the phrase.
# Loading all users is cheap at this scale (<= ~100).
_MENTION_RE = re.compile(r"@([A-Za-zÀ-ſ]+(?: [A-Za-zÀ-ſ]+)*)")


async def resolve_mentions(db: AsyncSession, body: Optional[str]) -> List[User]:
    """Return the distinct ``User`` rows mentioned via "@Name" in ``body``."""
    if not body or "@" not in body:
        return []
    all_users = (await db.execute(select(User))).scalars().all()
    users_by_lower = {}
    for u in all_users:
        users_by_lower.setdefault(u.name.lower(), u)

    found: List[User] = []
    seen: set[str] = set()
    for match in _MENTION_RE.finditer(body):
        words = match.group(1).split(" ")
        mentioned = None
        for k in range(len(words), 0, -1):  # longest prefix first
            candidate = " ".join(words[:k]).lower()
            if candidate in users_by_lower:
                mentioned = users_by_lower[candidate]
                break
        if mentioned and mentioned.id not in seen:
            seen.add(mentioned.id)
            found.append(mentioned)
    return found
