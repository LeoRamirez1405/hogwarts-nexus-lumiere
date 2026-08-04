from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..database import get_db
from ..models.feature_flag import FeatureFlag
from ..models.user import User
from ..schemas.feature_flag import (
    FeatureFlagCreate,
    FeatureFlagUpdate,
    FeatureFlagResponse,
    FeatureFlagListResponse,
)
from ..middleware.auth import get_current_user
from ..middleware.roles import require_role

router = APIRouter(tags=["feature-flags"])


@router.get("", response_model=FeatureFlagListResponse)
async def list_feature_flags(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    show_hidden: bool = Query(False, description="Include hidden feature flags"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(FeatureFlag)
    if not show_hidden:
        query = query.where(~FeatureFlag.hidden)
    query = query.offset(skip).limit(limit + 1)
    count_query = select(func.count(FeatureFlag.key))
    if not show_hidden:
        count_query = count_query.where(~FeatureFlag.hidden)
    result = await db.execute(query)
    items = result.scalars().all()
    items = items[:limit]
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()
    return FeatureFlagListResponse(
        items=[FeatureFlagResponse.model_validate(item) for item in items],
        total=total,
    )


@router.get("/{key}", response_model=FeatureFlagResponse)
async def get_feature_flag(
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(FeatureFlag).where(FeatureFlag.key == key))
    flag = result.scalar_one_or_none()
    if not flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")
    return FeatureFlagResponse.model_validate(flag)


@router.post("", response_model=FeatureFlagResponse, status_code=status.HTTP_201_CREATED)
async def create_feature_flag(
    data: FeatureFlagCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    existing = await db.execute(select(FeatureFlag).where(FeatureFlag.key == data.key))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Feature flag key already exists")
    flag = FeatureFlag(**data.model_dump())
    db.add(flag)
    await db.commit()
    await db.refresh(flag)
    return FeatureFlagResponse.model_validate(flag)


@router.put("/{key}", response_model=FeatureFlagResponse)
async def update_feature_flag(
    key: str,
    data: FeatureFlagUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(FeatureFlag).where(FeatureFlag.key == key))
    flag = result.scalar_one_or_none()
    if not flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(flag, field, value)
    await db.commit()
    await db.refresh(flag)
    return FeatureFlagResponse.model_validate(flag)


@router.delete("/{key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_feature_flag(
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(FeatureFlag).where(FeatureFlag.key == key))
    flag = result.scalar_one_or_none()
    if not flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")
    await db.delete(flag)
    await db.commit()