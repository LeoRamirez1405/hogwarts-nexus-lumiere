"""Public feature flag reads. Admin CRUD lives in routers.admin.feature_flags."""

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..cache import cache_get, cache_set
from ..database import get_db
from ..models.feature_flag import FeatureFlag
from ..models.user import User
from ..schemas.feature_flag import (
    FeatureFlagResponse,
    FeatureFlagListResponse,
)
from ..middleware.auth import get_current_user

router = APIRouter(tags=["feature-flags"])

_FLAGS_TTL = 60


@router.get("", response_model=FeatureFlagListResponse)
async def list_feature_flags(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    show_hidden: bool = Query(False, description="Include hidden feature flags"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cache_key = f"feature-flags:{skip}:{limit}:{show_hidden}"
    cached = cache_get(cache_key)
    if cached is not None:
        response.headers["Cache-Control"] = f"private, max-age={_FLAGS_TTL}"
        return cached
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
    payload = FeatureFlagListResponse(
        items=[FeatureFlagResponse.model_validate(item) for item in items],
        total=total,
    )
    cache_set(cache_key, payload, _FLAGS_TTL)
    response.headers["Cache-Control"] = f"private, max-age={_FLAGS_TTL}"
    return payload


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