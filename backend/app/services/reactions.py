"""Reaction helpers: validate targets, resolve owners, notify content owners."""

from typing import Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.article import Article, ArticleComment
from ..models.forum import ForumThread, ForumComment
from ..models.post import Post, PostComment
from ..notifications_service import N, notify


async def resolve_target_owner(
    db: AsyncSession, target_type: str, target_id: str
) -> Tuple[Optional[str], Optional[str]]:
    """Return ``(owner_user_id, navigable_parent_id)`` for a reaction target,
    or ``(None, None)`` when the target does not exist.

    ``navigable_parent_id`` points to the post / thread / article the UI should
    navigate to when the user taps the notification.
    """
    if target_type == "post":
        row = (await db.execute(select(Post).where(Post.id == target_id))).scalar_one_or_none()
        if not row:
            return None, None
        return row.author_id, row.id
    if target_type == "post_comment":
        row = (
            await db.execute(select(PostComment).where(PostComment.id == target_id))
        ).scalar_one_or_none()
        if not row:
            return None, None
        return row.user_id, row.post_id
    if target_type == "forum_thread":
        row = (
            await db.execute(select(ForumThread).where(ForumThread.id == target_id))
        ).scalar_one_or_none()
        if not row:
            return None, None
        return row.author_id, row.id
    if target_type == "forum_comment":
        row = (
            await db.execute(select(ForumComment).where(ForumComment.id == target_id))
        ).scalar_one_or_none()
        if not row:
            return None, None
        return row.user_id, row.thread_id
    if target_type == "article":
        row = (
            await db.execute(select(Article).where(Article.id == target_id))
        ).scalar_one_or_none()
        if not row:
            return None, None
        return row.author_id, row.id
    if target_type == "article_comment":
        row = (
            await db.execute(select(ArticleComment).where(ArticleComment.id == target_id))
        ).scalar_one_or_none()
        if not row:
            return None, None
        return row.user_id, row.article_id
    return None, None


def reaction_notification_type(target_type: str) -> Optional[str]:
    """Notification type string for a reaction, or None when unhandled."""
    return {
        "post": N.POST_REACTION,
        "post_comment": N.POST_COMMENT_REACTION,
        "forum_thread": N.FORUM_REACTION,
        "forum_comment": N.FORUM_COMMENT_REACTION,
        "article_comment": N.ARTICLE_COMMENT_REACTION,
    }.get(target_type)


def reaction_target_label(target_type: str) -> str:
    """Human-readable label for the reacted content (notification title)."""
    return {
        "post": "tu publicación",
        "post_comment": "tu comentario",
        "forum_thread": "tu tema",
        "forum_comment": "tu comentario",
        "article_comment": "tu comentario",
    }.get(target_type, "tu contenido")


async def notify_reaction(
    db: AsyncSession,
    *,
    actor_name: str,
    actor_id: str,
    target_type: str,
    owner_id: str,
    navigable_id: str,
    emoji: str,
) -> None:
    """Create a notification for the content owner when someone reacts to it."""
    ntype = reaction_notification_type(target_type)
    if not ntype:
        return
    await notify(
        db,
        user_id=owner_id,
        type=ntype,
        title=f"{actor_name} reaccionó a {reaction_target_label(target_type)} con {emoji}",
        body=emoji,
        related_id=navigable_id,
        actor_id=actor_id,
    )
