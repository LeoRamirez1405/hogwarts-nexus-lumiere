"""Admin-only article management routes (prefix /admin/articles).

El Quisquilloso is editor-managed: create/update/delete are admin-only here.
Public reads (list, single, comments, subscriptions, full-state) live in
routers.articles.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...database import get_db
from ...middleware.roles import require_role
from ...models.article import Article, ArticleComment
from ...models.article_subscription import ArticleSubscription, Notification
from ...models.user import User
from ...notifications_service import N, notify, notify_all_users, resolve_mentions
from ...schemas.article import ArticleCreate, ArticleResponse, ArticleUpdate

router = APIRouter(prefix="/admin/articles", tags=["admin-articles"])


async def clear_other_pinned(db: AsyncSession, keep_id: str):
    """Ensure at most one pinned article exists by un-pinning all others."""
    await db.execute(
        update(Article)
        .where(Article.id != keep_id, Article.pinned)
        .values(pinned=False)
    )


async def notify_subscribers(db: AsyncSession, article: Article, notification_type: str):
    """Send notifications to all subscribers of an article."""
    result = await db.execute(
        select(ArticleSubscription)
        .options(selectinload(ArticleSubscription.user))
        .where(ArticleSubscription.article_id == article.id)
    )
    subscriptions = result.scalars().all()

    if notification_type == "article_created":
        title = "Nuevo artículo publicado"
        body = f'Se ha publicado "{article.title}" en El Quisquilloso'
    else:  # article_updated
        title = "Artículo actualizado"
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


@router.post("/", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
async def create_article(
    article_data: ArticleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    article = Article(
        **article_data.model_dump(),
        author_id=current_user.id,
    )
    db.add(article)
    await db.commit()
    await db.refresh(article)

    # Only one article may be pinned as the main story at a time.
    if article.pinned:
        await clear_other_pinned(db, article.id)
        await db.commit()

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

    # Notify anyone @mentioned in the article body.
    mentioned = await resolve_mentions(db, article.body)
    if mentioned:
        for user in mentioned:
            if user.id == current_user.id:
                continue
            await notify(
                db,
                user_id=user.id,
                type=N.ARTICLE_MENTION,
                title=f"{current_user.name} te mencionó en {article.title}",
                body=(article.body or "")[:200],
                related_id=article.id,
                actor_id=current_user.id,
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
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(
        select(Article).options(selectinload(Article.author)).where(Article.id == article_id)
    )
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    for key, value in update_data.model_dump(exclude_unset=True).items():
        setattr(article, key, value)

    await db.commit()
    await db.refresh(article)

    # Only one article may be pinned as the main story at a time.
    if article.pinned:
        await clear_other_pinned(db, article.id)
        await db.commit()

    # Notify subscribers
    await notify_subscribers(db, article, "article_updated")

    article.subscribed = False
    return article


@router.delete("/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_article(
    article_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Remove comments and subscriptions so the article can be deleted without
    # a FK violation or orphaned rows.
    await db.execute(delete(ArticleComment).where(ArticleComment.article_id == article_id))
    await db.execute(delete(ArticleSubscription).where(ArticleSubscription.article_id == article_id))
    await db.delete(article)
    await db.commit()
