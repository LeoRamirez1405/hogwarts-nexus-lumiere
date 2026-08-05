"""Admin-only enum type routes (prefix /admin/enums)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.roles import require_role
from ...models.enum_type import EnumCategory, EnumValue
from ...models.user import User
from ...schemas.enum_type import (
    EnumCategoryCreate,
    EnumCategoryResponse,
    EnumCategoryUpdate,
    EnumValueCreate,
    EnumValueResponse,
    EnumValueUpdate,
)

router = APIRouter(prefix="/admin/enums", tags=["admin-enums"])


@router.post(
    "/categories",
    response_model=EnumCategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_category(
    data: EnumCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    existing = await db.execute(select(EnumCategory).where(EnumCategory.code == data.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Category code already exists")
    category = EnumCategory(**data.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.put("/categories/{category_id}", response_model=EnumCategoryResponse)
async def update_category(
    category_id: str,
    data: EnumCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(EnumCategory).where(EnumCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(category, key, value)
    await db.commit()
    await db.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(EnumCategory).where(EnumCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.delete(category)
    await db.commit()


@router.post(
    "/categories/{category_id}/values",
    response_model=EnumValueResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_value(
    category_id: str,
    data: EnumValueCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    cat_result = await db.execute(select(EnumCategory).where(EnumCategory.id == category_id))
    if not cat_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Category not found")

    existing = await db.execute(
        select(EnumValue).where(EnumValue.category_id == category_id, EnumValue.label == data.label)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Value label already exists in this category")

    value = EnumValue(**data.model_dump(), category_id=category_id)
    db.add(value)
    await db.commit()
    await db.refresh(value)
    return value


@router.put("/values/{value_id}", response_model=EnumValueResponse)
async def update_value(
    value_id: str,
    data: EnumValueUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(EnumValue).where(EnumValue.id == value_id))
    value = result.scalar_one_or_none()
    if not value:
        raise HTTPException(status_code=404, detail="Value not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(value, key, val)
    await db.commit()
    await db.refresh(value)
    return value


@router.delete("/values/{value_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_value(
    value_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(EnumValue).where(EnumValue.id == value_id))
    value = result.scalar_one_or_none()
    if not value:
        raise HTTPException(status_code=404, detail="Value not found")
    await db.delete(value)
    await db.commit()
