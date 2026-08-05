"""Admin-only feature flag routes (prefix /admin/feature-flags)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.roles import require_role
from ...models.feature_flag import FeatureFlag
from ...models.user import User
from ...schemas.feature_flag import (
    FeatureFlagCreate,
    FeatureFlagResponse,
    FeatureFlagUpdate,
)

router = APIRouter(prefix="/admin/feature-flags", tags=["admin-feature-flags"])


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
