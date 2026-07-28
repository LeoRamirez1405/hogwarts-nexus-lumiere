from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models.article_subscription import Notification
from ..models.user import User
from ..schemas.article import NotificationResponse
from ..middleware.auth import get_current_user

router = APIRouter()


@router.get("/", response_model=List[NotificationResponse])
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(100)
    )
    return result.scalars().all()


@router.get("/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.id, Notification.read == "false"
        )
    )
    notifications = result.scalars().all()
    return {"count": len(notifications)}


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

    notification.read = "true"
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
        .where(Notification.user_id == current_user.id, Notification.read == "false")
        .values(read="true")
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
            Notification.read == "false",
        )
        .values(read="true")
    )
    await db.commit()
    return {"updated": result.rowcount or 0}