from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models.article import Article, ArticleComment
from ..models.user import User
from ..models.article_subscription import ArticleSubscription, Notification
from ..schemas.article import (
    ArticleCreate, ArticleUpdate, ArticleResponse, ArticleSubscriptionResponse,
    NotificationResponse, ArticleCommentCreate, ArticleCommentResponse,
)
from ..schemas.user import UserResponse
from ..middleware.auth import get_current_user
from ..middleware.roles import require_role
from ..notifications_service import notify, notify_all_users, resolve_mentions, N

router = APIRouter()


async def notify_subscribers(db: AsyncSession, article: Article, notification_type: str):
    """Send notifications to all subscribers of an article."""
    result = await db.execute(
        select(ArticleSubscription)
        .options(selectinload(ArticleSubscription.user))
        .where(ArticleSubscription.article_id == article.id)
    )
    subscriptions = result.scalars().all()

    if notification_type == "article_created":
        title = "Nuevo articulo publicado"
        body = f'Se ha publicado "{article.title}" en El Quisquilloso'
    else:  # article_updated
        title = "Articulo actualizado"
        body = f'Se ha actualizado "{article.title}"'

    for sub in subscriptions:
        notification = Notification(
            user_id=sub.user_id,
            type=notification_type,
            title=title,
            body=body,
            related_id=article.id,
            read="false",
        )
        db.add(notification)

    if subscriptions:
        await db.commit()


@router.get("/", response_model=List[ArticleResponse])
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
    
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Article.title.ilike(search_term),
                Article.body.ilike(search_term),
            )
        )
    
    if category:
        query = query.where(Article.category == category)
    
    if featured_only:
        query = query.where(Article.featured == True)
    
    query = query.order_by(Article.created_at.desc()).limit(limit).offset(offset)
    
    result = await db.execute(query)
    articles = result.scalars().all()

    # Get user's subscriptions
    sub_result = await db.execute(
        select(ArticleSubscription.article_id).where(ArticleSubscription.user_id == current_user.id)
    )
    subscribed_ids = {row[0] for row in sub_result.all()}

    # Add subscribed flag
    for article in articles:
        article.subscribed = article.id in subscribed_ids

    return articles


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


@router.post("/", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
async def create_article(
    article_data: ArticleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    article = Article(
        **article_data.model_dump(),
        author_id=current_user.id,
    )
    db.add(article)
    await db.commit()
    await db.refresh(article)

    # A brand-new article is public news: tell everyone (except the author).
    await notify_all_users(
        db,
        type=N.ARTICLE_CREATED,
        title="Nuevo artículo en El Quisquilloso",
        body=f'Se publicó "{article.title}"',
        related_id=article.id,
        exclude_id=current_user.id,
    )
    await db.commit()

    # Load author for response
    result = await db.execute(
        select(Article).options(selectinload(Article.author)).where(Article.id == article.id)
    )
    article = result.scalar_one()
    article.subscribed = False
    return article


@router.put("/{article_id}", response_model=ArticleResponse)
async def update_article(
    article_id: str,
    update_data: ArticleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Article).options(selectinload(Article.author)).where(Article.id == article_id)
    )
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    if article.author_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    for key, value in update_data.model_dump(exclude_unset=True).items():
        setattr(article, key, value)

    await db.commit()
    await db.refresh(article)

    # Notify subscribers
    await notify_subscribers(db, article, "article_updated")

    article.subscribed = False
    return article


@router.delete("/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_article(
    article_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    if article.author_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.delete(article)
    await db.commit()


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
        .order_by(ArticleComment.created_at.desc())
    )
    comments = result.scalars().all()
    out = []
    for c in comments:
        resp = ArticleCommentResponse.model_validate(c)
        if c.user:
            resp.author = UserResponse.model_validate(c.user)
        out.append(resp)
    return out


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
    body = data.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="El comentario no puede estar vacío")

    article = (
        await db.execute(select(Article).where(Article.id == article_id))
    ).scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    comment = ArticleComment(article_id=article_id, user_id=current_user.id, body=body)
    db.add(comment)
    await db.flush()

    # Recipients: the author, every subscriber, and anyone @mentioned — deduped,
    # never the commenter themselves (notify() also guards actor == user).
    subs = (
        await db.execute(
            select(ArticleSubscription.user_id).where(
                ArticleSubscription.article_id == article_id
            )
        )
    ).scalars().all()
    recipients = {article.author_id, *subs}
    for u in await resolve_mentions(db, body):
        recipients.add(u.id)
    recipients.discard(current_user.id)

    for uid in recipients:
        await notify(
            db,
            user_id=uid,
            type=N.ARTICLE_COMMENT,
            title=f"{current_user.name} comentó en {article.title}",
            body=body[:200],
            related_id=article_id,
            actor_id=current_user.id,
        )

    await db.commit()
    await db.refresh(comment)
    resp = ArticleCommentResponse.model_validate(comment)
    resp.author = UserResponse.model_validate(current_user)
    return resp


@router.get("/notifications", response_model=List[NotificationResponse])
async def get_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    notifications = result.scalars().all()

    for n in notifications:
        n.read = n.read == "true"

    return notifications


@router.post("/notifications/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            and_(
                Notification.id == notification_id,
                Notification.user_id == current_user.id,
            )
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.read = "true"
    await db.commit()
    await db.refresh(notification)
    notification.read = True
    return notification


@router.post("/notifications/read-all")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            and_(
                Notification.user_id == current_user.id,
                Notification.read == "false",
            )
        )
    )
    notifications = result.scalars().all()

    for n in notifications:
        n.read = "true"

    await db.commit()
    return {"marked": len(notifications)}
