from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models.creature import Creature
from ..models.user_creature import UserCreature
from ..models.user import User
from ..schemas.creature import (
    CreatureCreate, CreatureResponse, UserCreatureResponse, FeedRequest,
)
from ..middleware.auth import get_current_user
from ..middleware.roles import require_role

router = APIRouter()


@router.get("/", response_model=List[CreatureResponse])
async def list_creatures(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Creature).order_by(Creature.price))
    return result.scalars().all()


@router.get("/my", response_model=List[UserCreatureResponse])
async def my_creatures(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserCreature).where(UserCreature.user_id == current_user.id)
    )
    return result.scalars().all()


@router.get("/{creature_id}", response_model=CreatureResponse)
async def get_creature(
    creature_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Creature).where(Creature.id == creature_id))
    creature = result.scalar_one_or_none()
    if not creature:
        raise HTTPException(status_code=404, detail="Creature not found")
    return creature


@router.post("/", response_model=CreatureResponse, status_code=status.HTTP_201_CREATED)
async def create_creature(
    creature_data: CreatureCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
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
    current_user: User = Depends(require_role("admin")),
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
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(Creature).where(Creature.id == creature_id))
    creature = result.scalar_one_or_none()
    if not creature:
        raise HTTPException(status_code=404, detail="Creature not found")
    await db.delete(creature)
    await db.commit()


@router.post("/{creature_id}/adopt", response_model=UserCreatureResponse)
async def adopt_creature(
    creature_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Creature).where(Creature.id == creature_id))
    creature = result.scalar_one_or_none()
    if not creature:
        raise HTTPException(status_code=404, detail="Creature not found")

    if current_user.zerines < creature.price:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Not enough zerines. Need {creature.price}, have {current_user.zerines}",
        )

    existing = await db.execute(
        select(UserCreature).where(
            UserCreature.user_id == current_user.id,
            UserCreature.creature_id == creature_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already own this creature",
        )

    current_user.zerines -= creature.price
    user_creature = UserCreature(user_id=current_user.id, creature_id=creature_id)
    db.add(user_creature)
    await db.commit()
    await db.refresh(user_creature)
    return user_creature


@router.post("/{creature_id}/feed", response_model=UserCreatureResponse)
async def feed_creature(
    creature_id: str,
    feed_data: FeedRequest = FeedRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserCreature).where(
            UserCreature.user_id == current_user.id,
            UserCreature.creature_id == creature_id,
        )
    )
    user_creature = result.scalar_one_or_none()
    if not user_creature:
        raise HTTPException(status_code=404, detail="You don't own this creature")

    user_creature.hunger = min(100, user_creature.hunger + feed_data.amount)
    user_creature.happiness = min(100, user_creature.happiness + 5)
    if user_creature.hunger >= 80 and user_creature.happiness >= 80:
        user_creature.level += 1

    await db.commit()
    await db.refresh(user_creature)
    return user_creature


@router.post("/{creature_id}/play", response_model=UserCreatureResponse)
async def play_creature(
    creature_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserCreature).where(
            UserCreature.user_id == current_user.id,
            UserCreature.creature_id == creature_id,
        )
    )
    user_creature = result.scalar_one_or_none()
    if not user_creature:
        raise HTTPException(status_code=404, detail="You don't own this creature")

    user_creature.happiness = min(100, user_creature.happiness + 15)
    user_creature.hunger = max(0, user_creature.hunger - 10)
    if user_creature.happiness >= 90:
        user_creature.level += 1

    await db.commit()
    await db.refresh(user_creature)
    return user_creature
