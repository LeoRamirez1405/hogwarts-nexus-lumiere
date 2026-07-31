from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..database import get_db
from ..models.post import Post, PostLike, PostRepost, PostComment
from ..models.user import User
from ..schemas.post import PostCreate, PostUpdate, PostResponse, CommentCreate, CommentResponse
from ..schemas.user import UserResponse
from ..schemas.pagination import Page
from ..middleware.auth import get_current_user
from ..notifications_service import notify, notify_like, notify_friends_of_post, resolve_mentions, N

router = APIRouter()


async def _build_posts_response(
    db: AsyncSession,
    posts: List[Post],
    current_user: User,
) -> List[PostResponse]:
    """Enrich a page of posts with counts + the current user's state.

    Instead of running 6 queries per post (the old ``_build_post_response``),
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


async def _build_post_response(
    db: AsyncSession,
    post: Post,
    current_user: User,
) -> PostResponse:
    """Enrich a single Post (used by mutations and detail endpoints)."""
    return (await _build_posts_response(db, [post], current_user))[0]


@router.get("/", response_model=Page[PostResponse])
async def list_posts(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Post)
        .order_by(Post.created_at.desc())
        .offset(skip)
        .limit(limit + 1)
    )
    posts = result.scalars().all()
    has_more = len(posts) > limit
    posts = posts[:limit]
    total = (await db.execute(select(func.count(Post.id)))).scalar_one()
    return Page(
        items=await _build_posts_response(db, posts, current_user),
        total=total,
        skip=skip,
        limit=limit,
        has_more=has_more,
    )


@router.get("/user/{user_id}", response_model=Page[PostResponse])
async def list_user_feed(
    user_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Profile feed: posts authored by the user plus posts they've reposted,
    ordered by most recent activity. Reposts carry `is_repost` / `reposted_by`."""
    # Posts authored by the user
    authored_result = await db.execute(
        select(Post).where(Post.author_id == user_id).order_by(Post.created_at.desc())
    )
    authored = list(authored_result.scalars().all())

    # Posts reposted by the user
    reposts_result = await db.execute(
        select(PostRepost).where(PostRepost.user_id == user_id)
    )
    reposts = list(reposts_result.scalars().all())

    profile_user = (
        await db.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()

    # Build a list of (feed_time, is_repost, post, repost) so we can order them
    entries = []
    for post in authored:
        entries.append((post.created_at, False, post, None))
    for repost in reposts:
        post = (
            await db.execute(select(Post).where(Post.id == repost.post_id))
        ).scalar_one_or_none()
        if post is None:
            continue
        # Avoid showing a repost of your own post twice
        if post.author_id == user_id:
            continue
        entries.append((repost.created_at, True, post, repost))

    entries.sort(key=lambda e: e[0], reverse=True)

    total = len(entries)
    page_entries = entries[skip : skip + limit]
    has_more = skip + limit < total

    responses = await _build_posts_response(
        db, [entry[2] for entry in page_entries], current_user
    )
    for (feed_time, is_repost, post, repost), response in zip(page_entries, responses):
        if is_repost:
            response.is_repost = True
            response.reposted_by = (
                UserResponse.model_validate(profile_user) if profile_user else None
            )
            response.reposted_at = repost.created_at
    return Page(
        items=responses,
        total=total,
        skip=skip,
        limit=limit,
        has_more=has_more,
    )


@router.post("/", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    post_data: PostCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = Post(
        author_id=current_user.id,
        body=(post_data.body or "").strip(),
        image_url=(post_data.image_url or "").strip() or None,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)

    # Notify friends about the new post.
    await notify_friends_of_post(db, post, current_user)
    await db.commit()
    await db.refresh(post)

    # Notify anyone @mentioned in the post body.
    mentioned = await resolve_mentions(db, post.body)
    if mentioned:
        for user in mentioned:
            await notify(
                db,
                user_id=user.id,
                type=N.POST_MENTION,
                title=f"{current_user.name} te mencionó en una publicación",
                body=(post.body or "")[:200],
                related_id=post.id,
                actor_id=current_user.id,
            )
        await db.commit()

    response = PostResponse.model_validate(post)
    response.likes_count = 0
    response.liked_by_me = False
    return response


@router.post("/{post_id}/like", response_model=PostResponse)
async def toggle_like(
    post_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    existing = await db.execute(
        select(PostLike).where(
            PostLike.post_id == post_id,
            PostLike.user_id == current_user.id,
        )
    )
    like = existing.scalar_one_or_none()

    liked_now = False
    if like:
        await db.delete(like)
    else:
        db.add(PostLike(post_id=post_id, user_id=current_user.id))
        liked_now = True

    await db.flush()
    if liked_now:
        await notify_like(db, post, current_user)
    await db.commit()

    return await _build_post_response(db, post, current_user)


@router.post("/{post_id}/repost", response_model=PostResponse)
async def toggle_repost(
    post_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    existing = await db.execute(
        select(PostRepost).where(
            PostRepost.post_id == post_id,
            PostRepost.user_id == current_user.id,
        )
    )
    repost = existing.scalar_one_or_none()

    reposted_now = False
    if repost:
        await db.delete(repost)
    else:
        db.add(PostRepost(post_id=post_id, user_id=current_user.id))
        reposted_now = True

    if reposted_now:
        await notify(
            db,
            user_id=post.author_id,
            type=N.POST_REPOST,
            title=f"{current_user.name} compartió tu publicación",
            body=(post.body or "Tu publicación")[:140],
            related_id=post_id,
            actor_id=current_user.id,
        )
    await db.commit()

    return await _build_post_response(db, post, current_user)


@router.get("/{post_id}/comments", response_model=List[CommentResponse])
async def list_comments(
    post_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PostComment)
        .where(PostComment.post_id == post_id)
        .order_by(PostComment.created_at.asc())
    )
    comments = result.scalars().all()
    responses = []
    for c in comments:
        resp = CommentResponse.model_validate(c)
        if c.user:
            resp.author = UserResponse.model_validate(c.user)
        responses.append(resp)
    return responses


@router.post(
    "/{post_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    post_id: str,
    comment_data: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    body = comment_data.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Comment cannot be empty")

    post = (
        await db.execute(select(Post).where(Post.id == post_id))
    ).scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comment = PostComment(
        post_id=post_id,
        user_id=current_user.id,
        body=body,
    )
    db.add(comment)
    await db.flush()

    # Notify the post author, plus anyone @mentioned in the comment.
    await notify(
        db,
        user_id=post.author_id,
        type=N.POST_COMMENT,
        title=f"{current_user.name} comentó tu publicación",
        body=body[:200],
        related_id=post_id,
        actor_id=current_user.id,
    )
    for mentioned in await resolve_mentions(db, body):
        if mentioned.id == post.author_id:
            continue  # already covered by the comment notification
        await notify(
            db,
            user_id=mentioned.id,
            type=N.POST_MENTION,
            title=f"{current_user.name} te mencionó en un comentario",
            body=body[:200],
            related_id=post_id,
            actor_id=current_user.id,
        )

    await db.commit()
    await db.refresh(comment)
    resp = CommentResponse.model_validate(comment)
    resp.author = UserResponse.model_validate(current_user)
    return resp


@router.put("/{post_id}", response_model=PostResponse)
async def update_post(
    post_id: str,
    post_data: PostUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Edit a post. Only the original author can edit it. Sets edited_at and edited_by."""
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if post.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot edit another user's post")

    body = (post_data.body or "").strip()
    image_url = (post_data.image_url or "").strip()
    if not body and not image_url:
        raise HTTPException(status_code=400, detail="Post must have either body text or an image")

    post.body = body
    post.image_url = image_url or None
    post.edited_at = datetime.utcnow()
    post.edited_by = current_user.id

    await db.commit()
    await db.refresh(post)

    return await _build_post_response(db, post, current_user)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a post. Only the original author can delete it."""
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if post.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot delete another user's post")

    await db.delete(post)
    await db.commit()
    return None
