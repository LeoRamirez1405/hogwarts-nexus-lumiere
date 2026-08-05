"""Public enum type reads. Admin CRUD lives in routers.admin.enums."""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models.enum_type import EnumCategory, EnumValue
from ..models.user import User
from ..schemas.enum_type import (
    EnumCategoryWithValues,
    EnumValueResponse,
)
from ..schemas.pagination import Page
from ..middleware.auth import get_current_user

router = APIRouter(tags=["enum-types"])


# ── Category endpoints ──

@router.get("/categories", response_model=Page[EnumCategoryWithValues])
async def list_categories(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(EnumCategory)
        .options(selectinload(EnumCategory.values))
        .offset(skip)
        .limit(limit + 1)
    )
    count_query = select(func.count(EnumCategory.id))
    result = await db.execute(query)
    items = result.scalars().all()
    has_more = len(items) > limit
    items = items[:limit]
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()
    return Page(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
        has_more=has_more,
    )


@router.get("/categories/{category_id}", response_model=EnumCategoryWithValues)
async def get_category(
    category_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(EnumCategory)
        .options(selectinload(EnumCategory.values))
        .where(EnumCategory.id == category_id)
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.get("/categories/code/{code}", response_model=EnumCategoryWithValues)
async def get_category_by_code(
    code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(EnumCategory)
        .options(selectinload(EnumCategory.values))
        .where(EnumCategory.code == code)
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


# ── Value endpoints ──

@router.get("/categories/{category_id}/values", response_model=List[EnumValueResponse])
async def list_values(
    category_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(EnumValue).where(EnumValue.category_id == category_id)
    )
    return result.scalars().all()