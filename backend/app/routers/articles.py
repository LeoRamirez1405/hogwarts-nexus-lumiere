from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models.article import Article, ArticleComment
from ..models.announcement import Announcement
from ..models.classified import Classified
from ..models.user import User
from ..models.article_subscription import ArticleSubscription
from ..schemas.article import (
    ArticleResponse, ArticleSubscriptionResponse,
    ArticleCommentCreate, ArticleCommentResponse,
    NewsFullStateResponse,
)
from ..schemas.user import UserResponse
from ..schemas.pagination import Page
from ..middleware.auth import get_current_user
from ..notifications_service import notify, resolve_mentions, N
from ..services.friend_notifications import notify_friends_of_activity
from ..services.comment_threads import nest_comments

router = APIRouter()


@router.get("/", response_model=Page[ArticleResponse])
async def list_articles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    featured_only: Optional[bool] = Query(False),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    query = select(Article).options(selectinload(Article.author))
    count_query = select(func.count(Article.id))

    if search:
        search_term = f"%{search}%"
        search_filter = or_(
            Article.title.ilike(search_term),
            Article.body.ilike(search_term),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if category:
        query = query.where(Article.category == category)
        count_query = count_query.where(Article.category == category)

    if featured_only:
        query = query.where(Article.featured)
        count_query = count_query.where(Article.featured)

    # Pinned article first so the main story is always on the first page,
    # then most recent.
    query = (
        query.order_by(Article.pinned.desc(), Article.created_at.desc())
        .limit(limit + 1)
        .offset(offset)
    )

    result = await db.execute(query)
    articles = result.scalars().all()
    has_more = len(articles) > limit
    articles = articles[:limit]

    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Get user's subscriptions
    sub_result = await db.execute(
        select(ArticleSubscription.article_id).where(ArticleSubscription.user_id == current_user.id)
    )
    subscribed_ids = {row[0] for row in sub_result.all()}

    # Add subscribed flag
    for article in articles:
        article.subscribed = article.id in subscribed_ids

    return Page(
        items=articles,
        total=total,
        skip=offset,
        limit=limit,
        has_more=has_more,
    )


@router.get("/categories", response_model=List[str])
async def get_article_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Article.category).distinct().where(Article.category.isnot(None))
    )
    categories = result.scalars().all()
    return sorted([c for c in categories if c])


@router.post("/{article_id}/subscribe", response_model=ArticleSubscriptionResponse)
async def subscribe_article(
    article_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check article exists
    article_result = await db.execute(select(Article).where(Article.id == article_id))
    article = article_result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Check if already subscribed
    existing = await db.execute(
        select(ArticleSubscription).where(
            and_(
                ArticleSubscription.user_id == current_user.id,
                ArticleSubscription.article_id == article_id,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already subscribed")

    subscription = ArticleSubscription(user_id=current_user.id, article_id=article_id)
    db.add(subscription)
    await db.commit()
    await db.refresh(subscription)
    return subscription


@router.delete("/{article_id}/subscribe", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe_article(
    article_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ArticleSubscription).where(
            and_(
                ArticleSubscription.user_id == current_user.id,
                ArticleSubscription.article_id == article_id,
            )
        )
    )
    subscription = result.scalar_one_or_none()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    await db.delete(subscription)
    await db.commit()


@router.get("/my/subscriptions", response_model=List[ArticleResponse])
async def get_my_subscriptions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Article)
        .join(ArticleSubscription, Article.id == ArticleSubscription.article_id)
        .where(ArticleSubscription.user_id == current_user.id)
        .options(selectinload(Article.author))
        .order_by(Article.created_at.desc())
    )
    articles = result.scalars().all()

    for article in articles:
        article.subscribed = True

    return articles


@router.get("/{article_id}/comments", response_model=List[ArticleCommentResponse])
async def list_article_comments(
    article_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ArticleComment)
        .where(ArticleComment.article_id == article_id)
        .order_by(ArticleComment.created_at.asc())
    )
    comments = result.scalars().all()
    return nest_comments(comments, lambda c: _article_comment_response(c))


def _article_comment_response(c: ArticleComment) -> ArticleCommentResponse:
    resp = ArticleCommentResponse.model_validate(c)
    if c.user:
        resp.author = UserResponse.model_validate(c.user)
    return resp


@router.post(
    "/{article_id}/comments",
    response_model=ArticleCommentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_article_comment(
    article_id: str,
    data: ArticleCommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    body = (data.body or "").strip()
    image_url = (data.image_url or "").strip() or None
    video_url = (data.video_url or "").strip() or None
    video_poster_url = (data.video_poster_url or "").strip() or None
    video_duration = data.video_duration

    if not body and not image_url and not video_url:
        raise HTTPException(status_code=400, detail="El comentario no puede estar vacío")

    article = (
        await db.execute(select(Article).where(Article.id == article_id))
    ).scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Validate an optional parent (threaded replies live on the same article).
    parent = None
    if data.parent_id:
        parent = (
            await db.execute(
                select(ArticleComment).where(ArticleComment.id == data.parent_id)
            )
        ).scalar_one_or_none()
        if not parent or parent.article_id != article_id:
            raise HTTPException(status_code=404, detail="Parent comment not found")

    comment = ArticleComment(
        article_id=article_id,
        user_id=current_user.id,
        body=body,
        image_url=image_url,
        video_url=video_url,
        video_poster_url=video_poster_url,
        video_duration=video_duration,
        parent_id=parent.id if parent else None,
    )
    db.add(comment)

    # Commenters auto-follow the article so they keep getting notifications
    # for later comments (mirrors the forum auto-subscribe behavior).
    already = (
        await db.execute(
            select(ArticleSubscription.id).where(
                ArticleSubscription.article_id == article_id,
                ArticleSubscription.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if already is None:
        db.add(ArticleSubscription(user_id=current_user.id, article_id=article_id))

    await db.flush()

    # Recipients: the author, every subscriber, every previous commenter, and
    # anyone @mentioned — deduped, never the commenter themselves.
    subs = (
        await db.execute(
            select(ArticleSubscription.user_id).where(
                ArticleSubscription.article_id == article_id
            )
        )
    ).scalars().all()
    previous_commenters = set(
        (
            await db.execute(
                select(ArticleComment.user_id).where(
                    ArticleComment.article_id == article_id
                )
            )
        ).scalars().all()
    )
    recipients = {article.author_id, *subs, *previous_commenters}
    for u in await resolve_mentions(db, body):
        recipients.add(u.id)
    recipients.discard(current_user.id)

    preview = body[:200] if body else ("[Imagen]" if image_url else "[Video]")

    # A direct reply gets its own, more specific notification — take that
    # recipient out of the generic batch so they receive exactly one alert.
    reply_target = parent.user_id if parent is not None else None
    if reply_target is not None:
        recipients.discard(reply_target)
        await notify(
            db,
            user_id=reply_target,
            type=N.ARTICLE_COMMENT_REPLY,
            title=f"{current_user.name} respondió a tu comentario en {article.title}",
            body=preview,
            related_id=article_id,
            actor_id=current_user.id,
        )

    for uid in recipients:
        await notify(
            db,
            user_id=uid,
            type=N.ARTICLE_COMMENT,
            title=f"{current_user.name} comentó en {article.title}",
            body=preview,
            related_id=article_id,
            actor_id=current_user.id,
        )

    # Friends get a lightweight "tu amigo comentó un artículo" alert. Anyone
    # already notified above (author, subscribers, commenters, mentions, reply
    # target) is excluded to avoid stacking generic + friend alerts.
    exclude_ids = {article.author_id, *recipients, *subs, *previous_commenters}
    if reply_target is not None:
        exclude_ids.add(reply_target)
    await notify_friends_of_activity(
        db,
        current_user,
        type=N.FRIEND_ARTICLE_COMMENT,
        title=f"Tu amigo {current_user.name} comentó el artículo {article.title}",
        body=preview,
        related_id=article_id,
        exclude_ids=exclude_ids,
    )

    await db.commit()
    await db.refresh(comment)
    resp = ArticleCommentResponse.model_validate(comment)
    resp.author = UserResponse.model_validate(current_user)
    return resp


@router.get("/full-state", response_model=NewsFullStateResponse)
async def get_news_full_state(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    articles_skip: int = Query(0, ge=0),
    articles_limit: int = Query(9, ge=1, le=100),
    featured_skip: int = Query(0, ge=0),
    featured_limit: int = Query(9, ge=1, le=100),
    saved_skip: int = Query(0, ge=0),
    saved_limit: int = Query(9, ge=1, le=100),
    announcements_limit: int = Query(20, ge=1, le=200),
    classifieds_limit: int = Query(20, ge=1, le=200),
):
    """Get all news page state in a single request.

    Returns paginated articles, featured articles, announcements, classifieds,
    and saved articles (subscriptions) with pagination metadata for each.
    """
    # Articles (all, paginated)
    articles_query = (
        select(Article)
        .options(selectinload(Article.author))
        .order_by(Article.pinned.desc(), Article.created_at.desc())
        .limit(articles_limit + 1)
        .offset(articles_skip)
    )
    articles_result = await db.execute(articles_query)
    articles = articles_result.scalars().all()
    articles_has_more = len(articles) > articles_limit
    articles = articles[:articles_limit]

    articles_total_result = await db.execute(select(func.count(Article.id)))
    articles_total = articles_total_result.scalar_one()

    # Featured articles (paginated)
    featured_query = (
        select(Article)
        .options(selectinload(Article.author))
        .where(Article.featured)
        .order_by(Article.created_at.desc())
        .limit(featured_limit + 1)
        .offset(featured_skip)
    )
    featured_result = await db.execute(featured_query)
    featured_articles = featured_result.scalars().all()
    featured_has_more = len(featured_articles) > featured_limit
    featured_articles = featured_articles[:featured_limit]

    featured_total_result = await db.execute(
        select(func.count(Article.id)).where(Article.featured)
    )
    featured_total = featured_total_result.scalar_one()

    # Saved articles (subscriptions, paginated)
    saved_query = (
        select(Article)
        .join(ArticleSubscription, Article.id == ArticleSubscription.article_id)
        .where(ArticleSubscription.user_id == current_user.id)
        .options(selectinload(Article.author))
        .order_by(Article.created_at.desc())
        .limit(saved_limit + 1)
        .offset(saved_skip)
    )
    saved_result = await db.execute(saved_query)
    saved_articles = saved_result.scalars().all()
    saved_has_more = len(saved_articles) > saved_limit
    saved_articles = saved_articles[:saved_limit]

    saved_total_result = await db.execute(
        select(func.count(Article.id))
        .join(ArticleSubscription, Article.id == ArticleSubscription.article_id)
        .where(ArticleSubscription.user_id == current_user.id)
    )
    saved_total = saved_total_result.scalar_one()

    # Announcements (limited, not paginated for sidebar)
    announcements_result = await db.execute(
        select(Announcement)
        .order_by(Announcement.created_at.desc())
        .limit(announcements_limit)
    )
    announcements = announcements_result.scalars().all()

    # Classifieds (limited, not paginated for sidebar)
    classifieds_result = await db.execute(
        select(Classified)
        .order_by(Classified.created_at.desc())
        .limit(classifieds_limit)
    )
    classifieds = classifieds_result.scalars().all()

    # Get user's subscriptions for all article lists
    sub_result = await db.execute(
        select(ArticleSubscription.article_id).where(ArticleSubscription.user_id == current_user.id)
    )
    subscribed_ids = {row[0] for row in sub_result.all()}

    # Add subscribed flag to all article lists
    for article in articles:
        article.subscribed = article.id in subscribed_ids
    for article in featured_articles:
        article.subscribed = article.id in subscribed_ids
    for article in saved_articles:
        article.subscribed = True  # saved articles are by definition subscribed

    return NewsFullStateResponse(
        articles=articles,
        articles_total=articles_total,
        articles_skip=articles_skip,
        articles_limit=articles_limit,
        articles_has_more=articles_has_more,
        featured_articles=featured_articles,
        featured_articles_total=featured_total,
        featured_articles_skip=featured_skip,
        featured_articles_limit=featured_limit,
        featured_articles_has_more=featured_has_more,
        announcements=announcements,
        classifieds=classifieds,
        saved_articles=saved_articles,
        saved_articles_total=saved_total,
        saved_articles_skip=saved_skip,
        saved_articles_limit=saved_limit,
        saved_articles_has_more=saved_has_more,
    )


# NOTE: this catch-all `/{article_id}` route MUST be registered last. FastAPI
# matches routes in definition order, so if it were declared before the literal
# GET routes (`/categories`, `/notifications`, `/full-state`) it would swallow
# them — e.g. GET /articles/full-state would bind article_id="full-state" and
# 404 with "Article not found". Keep it at the bottom.
@router.get("/{article_id}", response_model=ArticleResponse)
async def get_article(
    article_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Article).options(selectinload(Article.author)).where(Article.id == article_id)
    )
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Check subscription
    sub_result = await db.execute(
        select(ArticleSubscription).where(
            and_(
                ArticleSubscription.user_id == current_user.id,
                ArticleSubscription.article_id == article_id,
            )
        )
    )
    subscription = sub_result.scalar_one_or_none()
    article.subscribed = subscription is not None

    return article
