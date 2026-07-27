from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models.announcement import Announcement
from ..models.user import User
from ..schemas.announcement import (
    AnnouncementCreate,
    AnnouncementUpdate,
    AnnouncementResponse,
)
from ..middleware.auth import get_current_user
from ..middleware.roles import require_role
from ..notifications_service import notify_all_users, N

router = APIRouter()


@router.get("/", response_model=List[AnnouncementResponse])
async def list_announcements(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Announcement).order_by(Announcement.created_at.desc())
    )
    return result.scalars().all()


@router.post(
    "/",
    response_model=AnnouncementResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_announcement(
    data: AnnouncementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    announcement = Announcement(**data.model_dump())
    db.add(announcement)
    await db.commit()
    await db.refresh(announcement)

    # Broadcast the new announcement to everyone.
    await notify_all_users(
        db,
        type=N.ANNOUNCEMENT,
        title="Nuevo comunicado",
        body=(announcement.body or "")[:200],
        related_id=announcement.id,
        exclude_id=current_user.id,
    )
    await db.commit()
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


@router.delete(
    "/{announcement_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
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
