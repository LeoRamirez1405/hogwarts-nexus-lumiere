from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models.classified import Classified
from ..models.user import User
from ..schemas.announcement import (
    ClassifiedCreate,
    ClassifiedUpdate,
    ClassifiedResponse,
)
from ..middleware.auth import get_current_user
from ..middleware.roles import require_role

router = APIRouter()


@router.get("/", response_model=List[ClassifiedResponse])
async def list_classifieds(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Classified).order_by(Classified.created_at.desc())
    )
    return result.scalars().all()


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
