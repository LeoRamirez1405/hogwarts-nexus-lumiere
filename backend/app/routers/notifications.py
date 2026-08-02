from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, and_, or_
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models.article_subscription import Notification
from ..models.user import User
from ..schemas.article import NotificationResponse
from ..middleware.auth import get_current_user
from ..middleware.roles import require_role

router = APIRouter()

PAGE_SIZE_DEFAULT = 50


class NotificationPage(BaseModel):
    items: List[NotificationResponse]
    has_more: bool = False


@router.get("/", response_model=NotificationPage)
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(PAGE_SIZE_DEFAULT, ge=1, le=100),
    cursor: Optional[str] = Query(
        None,
        description="Opaque cursor '<created_at iso>:<id>' of the last item of the previous page",
    ),
):
    """Cursor-paginated notifications, newest first.

    The client derives the next cursor from the last item of the page
    (`created_at` + `:` + `id`). Ties on `created_at` are broken by id so the
    order is total and no item is skipped or duplicated across pages.
    """
    stmt = select(Notification).where(Notification.user_id == current_user.id)
    if cursor:
        # The ISO timestamp itself contains ':' (e.g. 05:07:51), so split from
        # the RIGHT: the id part is a UUID with no colons.
        ts_str, _, nid = cursor.rpartition(":")
        if not ts_str or not nid:
            raise HTTPException(status_code=400, detail="Invalid cursor")
        try:
            cursor_ts = datetime.fromisoformat(ts_str)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid cursor")
        stmt = stmt.where(
            or_(
                Notification.created_at < cursor_ts,
                and_(
                    Notification.created_at == cursor_ts,
                    Notification.id < nid,
                ),
            )
        )
    stmt = stmt.order_by(
        Notification.created_at.desc(), Notification.id.desc()
    ).limit(limit + 1)
    rows = (await db.execute(stmt)).scalars().all()
    has_more = len(rows) > limit
    return NotificationPage(items=list(rows[:limit]), has_more=has_more)


@router.get("/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id, Notification.read == False
        )
    )
    count = result.scalar() or 0
    return {"count": count}


@router.put("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id, Notification.user_id == current_user.id
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.read = True
    await db.commit()
    await db.refresh(notification)
    return notification


@router.put("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.read == False)
        .values(read=True)
    )
    await db.commit()


class ReadBatchRequest(BaseModel):
    ids: List[str]


@router.post("/read-batch")
async def mark_notifications_read_batch(
    payload: ReadBatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a specific set of the caller's notifications as read.

    Used by the client to auto-clear notifications when the user reaches the
    place a notification points to (by clicking it, or by navigating there on
    their own). Scoped to the current user so ids from others are ignored.
    """
    if not payload.ids:
        return {"updated": 0}
    result = await db.execute(
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.id.in_(payload.ids),
            Notification.read == False,
        )
        .values(read=True)
    )
    await db.commit()
    return {"updated": result.rowcount or 0}


@router.post("/test", response_model=List[NotificationResponse])
async def create_test_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Create a handful of sample notifications for EVERY user.

    Development/testing helper so the notification bell can be verified
    without having to trigger real events (articles, likes, mentions…).
    Admin-only; safe to call repeatedly (samples accumulate).
    """
    samples = [
        ("article_created", "Nuevo artículo publicado", "El Quisquilloso publicó 'El arte de la poción perfecta'"),
        ("post_like", "A alguien le gustó tu publicación", "Hermione Granger reaccionó a tu publicación"),
        ("mention", "Te mencionaron", "Luna Lovegood te mencionó en un comentario"),
        ("friend_request", "Nueva solicitud de amistad", "Cedric Diggory quiere ser tu amigo"),
        ("dm_message", "Nuevo mensaje", "Tienes un mensaje sin leer en tu bandeja"),
    ]
    user_ids = (await db.execute(select(User.id))).scalars().all()
    created = []
    for uid in user_ids:
        for ntype, title, body in samples:
            n = Notification(
                user_id=uid,
                type=ntype,
                title=title,
                body=body,
            )
            db.add(n)
            created.append(n)
    await db.commit()
    for n in created:
        await db.refresh(n)
    return created