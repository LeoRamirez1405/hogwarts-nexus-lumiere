"""Admin-only creature catalog routes (prefix /admin/creatures)."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.roles import require_role
from ...models.creature import Creature
from ...models.user import User
from ...models.user_creature import UserCreature
from ...schemas.creature import CreatureCreate, CreatureResponse
from ...schemas.pagination import Page

router = APIRouter(prefix="/admin/creatures", tags=["admin-creatures"])


@router.get("/", response_model=Page[CreatureResponse])
async def list_creatures(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    query = select(Creature)
    count_query = select(func.count(Creature.id))
    if search:
        search_term = f"%{search}%"
        search_filter = or_(
            Creature.name.ilike(search_term),
            Creature.description.ilike(search_term),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
    query = query.order_by(Creature.price).offset(skip).limit(limit + 1)
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


@router.post("/", response_model=CreatureResponse, status_code=status.HTTP_201_CREATED)
async def create_creature(
    creature_data: CreatureCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    creature = Creature(**creature_data.model_dump())
    db.add(creature)
    await db.commit()
    await db.refresh(creature)
    return creature


@router.put("/{creature_id}", response_model=CreatureResponse)
async def update_creature(
    creature_id: str,
    creature_data: CreatureCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    result = await db.execute(select(Creature).where(Creature.id == creature_id))
    creature = result.scalar_one_or_none()
    if not creature:
        raise HTTPException(status_code=404, detail="Creature not found")
    for key, value in creature_data.model_dump(exclude_unset=True).items():
        setattr(creature, key, value)
    await db.commit()
    await db.refresh(creature)
    return creature


@router.delete("/{creature_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_creature(
    creature_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    result = await db.execute(select(Creature).where(Creature.id == creature_id))
    creature = result.scalar_one_or_none()
    if not creature:
        raise HTTPException(status_code=404, detail="Creature not found")
    # Remove adoptions/ownership rows so the species can be deleted without a FK violation.
    await db.execute(delete(UserCreature).where(UserCreature.creature_id == creature_id))
    await db.delete(creature)
    await db.commit()
