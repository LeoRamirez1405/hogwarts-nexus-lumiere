"""Post response builders.

Keep the router thin (and under the line limit) by moving the feed-enrichment
queries here. ``build_posts_response`` enriches a whole page with a constant
number of aggregate queries instead of N+1 per-post lookups.
"""

from typing import List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.post import Post, PostLike, PostRepost, PostComment
from ..models.user import User
from ..schemas.post import PostResponse
from ..schemas.user import UserResponse


async def build_posts_response(
    db: AsyncSession,
    posts: List[Post],
    current_user: User,
) -> List[PostResponse]:
    """Enrich a page of posts with counts + the current user's state.

    Instead of running 6 queries per post (the old ``build_post_response``),
    the whole page is enriched with a constant number of aggregate queries:
    3 GROUP BY counts + 2 "my state" lookups + 1 editors fetch.
    """
    if not posts:
        return []
    ids = [p.id for p in posts]

    likes_count = {
        post_id: count
        for post_id, count in (
            await db.execute(
                select(PostLike.post_id, func.count())
                .where(PostLike.post_id.in_(ids))
                .group_by(PostLike.post_id)
            )
        ).all()
    }
    reposts_count = {
        post_id: count
        for post_id, count in (
            await db.execute(
                select(PostRepost.post_id, func.count())
                .where(PostRepost.post_id.in_(ids))
                .group_by(PostRepost.post_id)
            )
        ).all()
    }
    comments_count = {
        post_id: count
        for post_id, count in (
            await db.execute(
                select(PostComment.post_id, func.count())
                .where(PostComment.post_id.in_(ids))
                .group_by(PostComment.post_id)
            )
        ).all()
    }
    liked_ids = set(
        (
            await db.execute(
                select(PostLike.post_id).where(
                    PostLike.post_id.in_(ids),
                    PostLike.user_id == current_user.id,
                )
            )
        ).scalars().all()
    )
    reposted_ids = set(
        (
            await db.execute(
                select(PostRepost.post_id).where(
                    PostRepost.post_id.in_(ids),
                    PostRepost.user_id == current_user.id,
                )
            )
        ).scalars().all()
    )

    editor_ids = {p.edited_by for p in posts if p.edited_by}
    editors: dict = {}
    if editor_ids:
        for editor in (
            await db.execute(select(User).where(User.id.in_(editor_ids)))
        ).scalars().all():
            editors[editor.id] = editor

    responses: List[PostResponse] = []
    for post in posts:
        edited_by_user = None
        if post.edited_by and post.edited_by in editors:
            edited_by_user = UserResponse.model_validate(editors[post.edited_by])

        # Build the response from a dict instead of the ORM object to avoid
        # Pydantic trying to validate edited_by (a string FK) as UserResponse.
        responses.append(PostResponse.model_validate({
            "id": post.id,
            "author_id": post.author_id,
            "author": post.author,
            "body": post.body,
            "image_url": post.image_url,
            "video_url": post.video_url,
            "video_poster_url": post.video_poster_url,
            "video_duration": post.video_duration,
            "created_at": post.created_at,
            "edited_at": post.edited_at,
            "edited_by": edited_by_user,
            "likes_count": likes_count.get(post.id, 0),
            "liked_by_me": post.id in liked_ids,
            "reposts_count": reposts_count.get(post.id, 0),
            "reposted_by_me": post.id in reposted_ids,
            "comments_count": comments_count.get(post.id, 0),
        }))
    return responses


async def build_post_response(
    db: AsyncSession,
    post: Post,
    current_user: User,
) -> PostResponse:
    """Enrich a single Post (used by mutations and detail endpoints)."""
    return (await build_posts_response(db, [post], current_user))[0]
