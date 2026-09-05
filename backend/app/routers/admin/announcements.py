"""Admin-only announcement management routes (prefix /admin/announcements)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...cache import cache_clear_prefix
from ...database import get_db
from ...middleware.roles import require_role
from ...models.announcement import Announcement
from ...models.user import User
from ...notifications_service import N, notify_all_users
from ...schemas.announcement import (
    AnnouncementCreate,
    AnnouncementResponse,
    AnnouncementUpdate,
)

router = APIRouter(prefix="/admin/announcements", tags=["admin-announcements"])


@router.post("/", response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
async def create_announcement(
    data: AnnouncementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    announcement = Announcement(**data.model_dump())
    db.add(announcement)
    # The crowd notification is part of this same transaction: if its INSERT
    # fails (e.g. a schema mismatch), the whole create fails loudly and rolls
    # back — no half-created announcement, no silent masking, no retry
    # duplicates. Web/FCM push inside notify_all_users is already best-effort.
    await notify_all_users(
        db,
        type=N.ANNOUNCEMENT,
        title="Nuevo comunicado",
        body=(announcement.body or "")[:200],
        related_id=announcement.id,
        exclude_id=current_user.id,
    )
    await db.commit()
    await db.refresh(announcement)

    # Invalidate announcements cache so the new one shows immediately.
    cache_clear_prefix("announcements:")
    return announcement


@router.put("/{announcement_id}", response_model=AnnouncementResponse)
async def update_announcement(
    announcement_id: str,
    update_data: AnnouncementUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(
        select(Announcement).where(Announcement.id == announcement_id)
    )
    announcement = result.scalar_one_or_none()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")

    for key, value in update_data.model_dump(exclude_unset=True).items():
        setattr(announcement, key, value)

    await db.commit()
    await db.refresh(announcement)
    return announcement


@router.delete("/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_announcement(
    announcement_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(
        select(Announcement).where(Announcement.id == announcement_id)
    )
    announcement = result.scalar_one_or_none()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")

    await db.delete(announcement)
    await db.commit()
    cache_clear_prefix("announcements:")
