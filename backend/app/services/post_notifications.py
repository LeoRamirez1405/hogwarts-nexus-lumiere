"""Notification helpers for post engagement (likes, comments, reposts).

Centralizes the "engagement" notifications: when someone interacts with a
post, everyone else who already engaged with it (liked or commented) is
alerted, so conversations don't go unnoticed.
"""

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.post import PostLike, PostComment
from ..models.user import User
from ..notifications_service import notify, N


async def post_engager_ids(
    db: AsyncSession, post_id: str
) -> tuple[set[str], set[str]]:
    """Return (liker_ids, commenter_ids) for a post — everyone who interacted
    with it. Used to alert engaged users when new activity happens on a post
    they liked or commented on."""
    likers = set(
        (
            await db.execute(
                select(PostLike.user_id).where(PostLike.post_id == post_id)
            )
        ).scalars().all()
    )
    commenters = set(
        (
            await db.execute(
                select(PostComment.user_id).where(PostComment.post_id == post_id)
            )
        ).scalars().all()
    )
    return likers, commenters


async def notify_like_to_commenters(db: AsyncSession, post, actor: User) -> int:
    """Notify users who commented on a post that someone new liked it.

    Complements ``notify_like`` (which alerts the post author): people who
    joined the conversation on a post are told when someone else engages with
    it. Only commenters get this — the author is covered by ``notify_like``
    and other likers would create like-notification spam.
    """
    _, commenters = await post_engager_ids(db, post.id)
    recipients = commenters - {post.author_id, actor.id}
    body = (post.body or "")[:140]
    count = 0
    for uid in recipients:
        n = await notify(
            db,
            user_id=uid,
            type=N.POST_LIKE,
            title=f"A {actor.name} le gustó una publicación donde comentaste",
            body=body,
            related_id=post.id,
            actor_id=actor.id,
        )
        count += 1 if n is not None else 0
    return count


async def notify_comment_to_engagers(
    db: AsyncSession, post, actor: User, exclude_ids: Optional[set] = None
) -> int:
    """Notify everyone who liked or commented on a post that someone left a
    new comment on it (skips the post author and the commenter themselves).

    ``exclude_ids`` — typically the author of a replied-to comment, who is
    already getting a dedicated "reply" notification.
    """
    likers, commenters = await post_engager_ids(db, post.id)
    recipients = (likers | commenters) - {post.author_id, actor.id}
    if exclude_ids:
        recipients -= set(exclude_ids)
    body = (post.body or "")[:140]
    count = 0
    for uid in recipients:
        title = (
            f"{actor.name} comentó en una publicación donde comentaste"
            if uid in commenters
            else f"{actor.name} comentó en una publicación que te gustó"
        )
        n = await notify(
            db,
            user_id=uid,
            type=N.POST_COMMENT,
            title=title,
            body=body,
            related_id=post.id,
            actor_id=actor.id,
        )
        count += 1 if n is not None else 0
    return count


async def notify_repost(db: AsyncSession, post, actor: User) -> int:
    """Notify the post author plus everyone who liked/commented on the post
    that it was reposted (except the author and the reposter)."""
    count = 0
    n = await notify(
        db,
        user_id=post.author_id,
        type=N.POST_REPOST,
        title=f"{actor.name} compartió tu publicación",
        body=(post.body or "Tu publicación")[:140],
        related_id=post.id,
        actor_id=actor.id,
    )
    count += 1 if n is not None else 0

    likers, commenters = await post_engager_ids(db, post.id)
    recipients = (likers | commenters) - {post.author_id, actor.id}
    body = (post.body or "")[:140]
    for uid in recipients:
        title = (
            f"{actor.name} compartió una publicación donde comentaste"
            if uid in commenters
            else f"{actor.name} compartió una publicación que te gustó"
        )
        n = await notify(
            db,
            user_id=uid,
            type=N.POST_REPOST,
            title=title,
            body=body,
            related_id=post.id,
            actor_id=actor.id,
        )
        count += 1 if n is not None else 0
    return count
