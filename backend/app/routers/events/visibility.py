"""Events visibility settings router."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.event import EventVisibilitySettings
from ...models.user import User
from ...services.events import get_or_create_visibility_settings

router = APIRouter()


@router.get("", response_model=dict)
async def get_event_visibility(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get global events visibility setting (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.execute(select(EventVisibilitySettings).limit(1))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = EventVisibilitySettings(enabled=True)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)

    return {"enabled": settings.enabled}


@router.patch("", response_model=dict)
async def update_event_visibility(
    enabled: bool,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update global events visibility setting (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    settings = await get_or_create_visibility_settings(db, enabled=enabled, updated_by=current_user.id)
    return {"enabled": settings.enabled}