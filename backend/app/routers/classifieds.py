from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..database import get_db
from ..models.classified import Classified
from ..models.user import User
from ..schemas.announcement import (
    ClassifiedCreate,
    ClassifiedUpdate,
    ClassifiedResponse,
)
from ..schemas.pagination import Page
from ..middleware.auth import get_current_user
from ..middleware.roles import require_role

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


@router.post(
    "/",
    response_model=ClassifiedResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_classified(
    data: ClassifiedCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    classified = Classified(**data.model_dump())
    db.add(classified)
    await db.commit()
    await db.refresh(classified)
    return classified


@router.put("/{classified_id}", response_model=ClassifiedResponse)
async def update_classified(
    classified_id: str,
    update_data: ClassifiedUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(
        select(Classified).where(Classified.id == classified_id)
    )
    classified = result.scalar_one_or_none()
    if not classified:
        raise HTTPException(status_code=404, detail="Classified not found")

    for key, value in update_data.model_dump(exclude_unset=True).items():
        setattr(classified, key, value)

    await db.commit()
    await db.refresh(classified)
    return classified


@router.delete(
    "/{classified_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_classified(
    classified_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(
        select(Classified).where(Classified.id == classified_id)
    )
    classified = result.scalar_one_or_none()
    if not classified:
        raise HTTPException(status_code=404, detail="Classified not found")

    await db.delete(classified)
    await db.commit()
