from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..database import get_db
from ..models.post import Post, PostLike
from ..models.user import User
from ..schemas.post import PostCreate, PostResponse
from ..middleware.auth import get_current_user

router = APIRouter()


@router.get("/", response_model=List[PostResponse])
async def list_posts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Post).order_by(Post.created_at.desc()))
    posts = result.scalars().all()

    responses = []
    for post in posts:
        likes_result = await db.execute(
            select(func.count(PostLike.post_id)).where(PostLike.post_id == post.id)
        )
        likes_count = likes_result.scalar() or 0

        liked_result = await db.execute(
            select(PostLike).where(
                PostLike.post_id == post.id,
                PostLike.user_id == current_user.id,
            )
        )
        liked_by_me = liked_result.scalar_one_or_none() is not None

        post_response = PostResponse.model_validate(post)
        post_response.likes_count = likes_count
        post_response.liked_by_me = liked_by_me
        responses.append(post_response)

    return responses


@router.post("/", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    post_data: PostCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = Post(
        author_id=current_user.id,
        body=post_data.body,
        image_url=post_data.image_url,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)

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

    if like:
        await db.delete(like)
    else:
        db.add(PostLike(post_id=post_id, user_id=current_user.id))

    await db.commit()

    likes_result = await db.execute(
        select(func.count(PostLike.post_id)).where(PostLike.post_id == post_id)
    )
    likes_count = likes_result.scalar() or 0

    liked_result = await db.execute(
        select(PostLike).where(
            PostLike.post_id == post_id,
            PostLike.user_id == current_user.id,
        )
    )
    liked_by_me = liked_result.scalar_one_or_none() is not None

    response = PostResponse.model_validate(post)
    response.likes_count = likes_count
    response.liked_by_me = liked_by_me
    return response
