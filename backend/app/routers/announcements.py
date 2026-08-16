"""Public announcement listing. Admin CRUD lives in routers.admin.announcements."""

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..cache import cache_get, cache_set
from ..database import get_db
from ..models.announcement import Announcement
from ..models.user import User
from ..schemas.announcement import AnnouncementResponse
from ..schemas.pagination import Page
from ..middleware.auth import get_current_user

router = APIRouter()

_ANNOUNCEMENTS_TTL = 120


@router.get("/", response_model=Page[AnnouncementResponse])
async def list_announcements(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cache_key = f"announcements:{skip}:{limit}"
    cached = cache_get(cache_key)
    if cached is not None:
        response.headers["Cache-Control"] = f"private, max-age={_ANNOUNCEMENTS_TTL}"
        return cached
    result = await db.execute(
        select(Announcement)
        .order_by(Announcement.created_at.desc())
        .offset(skip)
        .limit(limit + 1)
    )
    items = result.scalars().all()
    has_more = len(items) > limit
    items = items[:limit]
    total_result = await db.execute(select(func.count(Announcement.id)))
    total = total_result.scalar_one()
    payload = Page(
        items=[AnnouncementResponse.model_validate(item) for item in items],
        total=total,
        skip=skip,
        limit=limit,
        has_more=has_more,
    )
    cache_set(cache_key, payload, _ANNOUNCEMENTS_TTL)
    response.headers["Cache-Control"] = f"private, max-age={_ANNOUNCEMENTS_TTL}"
    return payload
