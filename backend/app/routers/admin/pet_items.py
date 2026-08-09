"""Admin-only pet item routes (prefix /admin/pet-items)."""

from typing import Optional, Set

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.roles import require_role
from ...models.enum_type import EnumCategory, EnumValue
from ...models.pet_item import PetItem
from ...models.user import User
from ...models.user_pet_item import UserPetItem
from ...schemas.pagination import Page
from ...schemas.pet_item import (
    PetItemCreate,
    PetItemResponse,
    PetItemUpdate,
)

router = APIRouter(prefix="/admin/pet-items", tags=["admin-pet-items"])

VALID_KINDS = {"food", "toy"}
PET_TYPE_CATEGORY_CODE = "pet_type"


async def _valid_pet_types(db: AsyncSession) -> Set[str]:
    """Pet types are configured via the `pet_type` enum category in /settings."""
    result = await db.execute(
        select(EnumValue.label)
        .join(EnumCategory, EnumValue.category_id == EnumCategory.id)
        .where(EnumCategory.code == PET_TYPE_CATEGORY_CODE)
    )
    return set(result.scalars().all())


@router.get("/", response_model=Page[PetItemResponse])
async def list_pet_items(
    kind: Optional[str] = Query(None),
    pet_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    query = select(PetItem)
    count_query = select(func.count(PetItem.id))
    if kind:
        query = query.where(PetItem.kind == kind)
        count_query = count_query.where(PetItem.kind == kind)
    if pet_type:
        query = query.where(PetItem.pet_type == pet_type)
        count_query = count_query.where(PetItem.pet_type == pet_type)
    if search:
        search_term = f"%{search}%"
        search_filter = or_(
            PetItem.name.ilike(search_term),
            PetItem.description.ilike(search_term),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
    query = (
        query.order_by(PetItem.pet_type, PetItem.kind, PetItem.price)
        .offset(skip)
        .limit(limit + 1)
    )
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


@router.post("/", response_model=PetItemResponse, status_code=status.HTTP_201_CREATED)
async def create_pet_item(
    data: PetItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    if data.kind not in VALID_KINDS:
        raise HTTPException(status_code=400, detail="Invalid kind (food/toy)")
    if data.pet_type not in await _valid_pet_types(db):
        raise HTTPException(status_code=400, detail="Invalid pet_type")
    item = PetItem(**data.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.put("/{item_id}", response_model=PetItemResponse)
async def update_pet_item(
    item_id: str,
    data: PetItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(PetItem).where(PetItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Pet item not found")
    payload = data.model_dump(exclude_unset=True)
    if "kind" in payload and payload["kind"] not in VALID_KINDS:
        raise HTTPException(status_code=400, detail="Invalid kind (food/toy)")
    if "pet_type" in payload and payload["pet_type"] not in await _valid_pet_types(db):
        raise HTTPException(status_code=400, detail="Invalid pet_type")
    for key, value in payload.items():
        setattr(item, key, value)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pet_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(PetItem).where(PetItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Pet item not found")
    # Remove any inventory rows referencing this item to avoid dangling refs.
    inv = await db.execute(
        select(UserPetItem).where(UserPetItem.pet_item_id == item_id)
    )
    for row in inv.scalars().all():
        await db.delete(row)
    await db.delete(item)
    await db.commit()
