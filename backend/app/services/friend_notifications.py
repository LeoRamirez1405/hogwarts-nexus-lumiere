"""Friend-activity notifications.

When a user does something public (like a post, comment on a post, repost,
participate in a forum debate, comment on an article), every friend of that
user gets a lightweight "tu amigo hizo X" notification — a social feed of what
your friends are up to across the whole platform.

The recipient's own notification types (post_like, post_comment, forum_reply,
...) still fire for the people directly involved; this module only adds the
friend-observability layer. ``notify`` skips the actor himself, and callers
pass ``exclude_ids`` (e.g. the post author) to avoid double alerts.
"""

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.friend_request import FriendRequest
from ..models.user import User
from ..notifications_service import notify, N


async def friend_ids_of(db: AsyncSession, user_id: str) -> set[str]:
    """Every accepted friend of ``user_id`` (both directions)."""
    out = set(
        (
            await db.execute(
                select(FriendRequest.sender_id).where(
                    FriendRequest.receiver_id == user_id,
                    FriendRequest.status == "accepted",
                )
            )
        ).scalars().all()
    )
    out.update(
        (
            await db.execute(
                select(FriendRequest.receiver_id).where(
                    FriendRequest.sender_id == user_id,
                    FriendRequest.status == "accepted",
                )
            )
        ).scalars().all()
    )
    return out


async def notify_friend_like(db: AsyncSession, actor: User, post) -> int:
    """Notify friends that ``actor`` liked a post (author gets the direct alert)."""
    return await notify_friends_of_activity(
        db,
        actor,
        type=N.FRIEND_LIKE,
        title=f"Tu amigo {actor.name} dio like a una publicación",
        body=post.body[:140] if post.body else "Una publicación",
        related_id=actor.id,
        exclude_ids={post.author_id},
    )


async def notify_friend_comment(
    db: AsyncSession,
    actor: User,
    *,
    body: str,
    exclude_ids: Optional[set] = None,
) -> int:
    """Notify friends that ``actor`` commented on a post."""
    return await notify_friends_of_activity(
        db,
        actor,
        type=N.FRIEND_COMMENT,
        title=f"Tu amigo {actor.name} comentó una publicación",
        body=body[:200],
        related_id=actor.id,
        exclude_ids=exclude_ids,
    )


async def notify_friend_repost(db: AsyncSession, actor: User, post) -> int:
    """Notify friends that ``actor`` reposted a post (author gets the direct alert)."""
    return await notify_friends_of_activity(
        db,
        actor,
        type=N.FRIEND_REPOST,
        title=f"Tu amigo {actor.name} compartió una publicación",
        body=post.body[:140] if post.body else "Una publicación",
        related_id=actor.id,
        exclude_ids={post.author_id},
    )


async def notify_friends_of_activity(
    db: AsyncSession,
    actor: User,
    *,
    type: str,
    title: str,
    body: str,
    related_id: Optional[str] = None,
    exclude_ids: Optional[set] = None,
) -> int:
    """Send a notification about ``actor``'s public activity to all his friends.

    ``exclude_ids`` typically carries the post/thread/article author, who
    already receives the direct notification for that event.
    """
    fids = await friend_ids_of(db, actor.id)
    fids.discard(actor.id)
    if exclude_ids:
        fids -= set(exclude_ids)
    count = 0
    for uid in fids:
        n = await notify(
            db,
            user_id=uid,
            type=type,
            title=title,
            body=body[:200],
            related_id=related_id,
            actor_id=actor.id,
        )
        count += 1 if n is not None else 0
    return count