"""Public classified listing. Admin CRUD lives in routers.admin.classifieds."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..database import get_db
from ..models.classified import Classified
from ..models.user import User
from ..schemas.announcement import ClassifiedResponse
from ..schemas.pagination import Page
from ..middleware.auth import get_current_user

router = APIRouter()


@router.get("/", response_model=Page[ClassifiedResponse])
async def list_classifieds(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Classified)
        .order_by(Classified.created_at.desc())
        .offset(skip)
        .limit(limit + 1)
    )
    items = result.scalars().all()
    has_more = len(items) > limit
    items = items[:limit]
    total_result = await db.execute(select(func.count(Classified.id)))
    total = total_result.scalar_one()
    return Page(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
        has_more=has_more,
    )
