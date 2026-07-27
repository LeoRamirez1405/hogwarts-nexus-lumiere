from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..config import settings
from ..database import get_db
from ..models.creature import Creature
from ..models.user_creature import UserCreature
from ..models.pet_item import PetItem
from ..models.user_pet_item import UserPetItem
from ..models.user import User
from ..models.transaction import Transaction
from ..schemas.creature import (
    CreatureCreate, CreatureResponse, UserCreatureResponse, UseItemRequest,
)
from ..middleware.auth import get_current_user
from ..middleware.roles import require_role

router = APIRouter()


def _settle_decay(uc: UserCreature) -> None:
    """Apply elapsed-time hunger/happiness decay in place (clamped at 0).

    Idempotent per call: advances `last_decay_at` to now. Safe to call before
    any read or mutation so stored stats always reflect the current moment.
    """
    now = datetime.utcnow()
    last = uc.last_decay_at or uc.adopted_at or now
    hours = (now - last).total_seconds() / 3600.0
    if hours <= 0:
        uc.last_decay_at = now
        return
    hunger_loss = hours * settings.HUNGER_DECAY_PER_HOUR
    happiness_loss = hours * settings.HAPPINESS_DECAY_PER_HOUR
    uc.hunger = max(0, int(round(uc.hunger - hunger_loss)))
    uc.happiness = max(0, int(round(uc.happiness - happiness_loss)))
    uc.last_decay_at = now


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
    creatures = result.scalars().all()
    for uc in creatures:
        _settle_decay(uc)
    await db.commit()
    return creatures


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

    transaction = Transaction(
        sender_id=current_user.id,
        amount=creature.price,
        type="purchase",
        description=f"Adopcion: {creature.name}",
        status="confirmed",
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(user_creature)
    return user_creature


async def _consume_item(
    db: AsyncSession,
    current_user: User,
    user_creature_id: str,
    item_id: str,
    kind: str,
) -> tuple[UserCreature, PetItem]:
    """Shared validation + inventory consumption for feed/play.

    Verifies ownership of the creature, that the item is the right `kind`
    (food/toy) and matches the creature's `pet_type`, and that the user has
    at least one unit in inventory. Consumes exactly one unit and settles
    time-based decay. Returns (user_creature, item) for the caller to apply
    the restore effect. Does not commit.
    """
    uc_result = await db.execute(
        select(UserCreature).where(
            UserCreature.id == user_creature_id,
            UserCreature.user_id == current_user.id,
        )
    )
    user_creature = uc_result.scalar_one_or_none()
    if not user_creature:
        raise HTTPException(status_code=404, detail="You don't own this creature")

    item_result = await db.execute(select(PetItem).where(PetItem.id == item_id))
    item = item_result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Pet item not found")
    if item.kind != kind:
        expected = "comida" if kind == "food" else "un juguete"
        raise HTTPException(status_code=400, detail=f"Ese objeto no es {expected}")

    creature_type = user_creature.creature.pet_type if user_creature.creature else None
    if creature_type and item.pet_type != creature_type:
        raise HTTPException(
            status_code=400,
            detail="Ese objeto no es del tipo adecuado para esta mascota",
        )

    inv_result = await db.execute(
        select(UserPetItem).where(
            UserPetItem.user_id == current_user.id,
            UserPetItem.pet_item_id == item_id,
        )
    )
    inventory = inv_result.scalar_one_or_none()
    if not inventory or inventory.quantity <= 0:
        raise HTTPException(status_code=400, detail="No tienes este objeto en el inventario")

    _settle_decay(user_creature)
    inventory.quantity -= 1
    return user_creature, item


@router.post("/{user_creature_id}/feed", response_model=UserCreatureResponse)
async def feed_creature(
    user_creature_id: str,
    body: UseItemRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_creature, item = await _consume_item(
        db, current_user, user_creature_id, body.item_id, "food"
    )

    user_creature.hunger = min(100, user_creature.hunger + item.restore_amount)
    user_creature.happiness = min(100, user_creature.happiness + 5)
    if user_creature.hunger >= 80 and user_creature.happiness >= 80:
        user_creature.level += 1

    await db.commit()
    await db.refresh(user_creature)
    return user_creature


@router.post("/{user_creature_id}/play", response_model=UserCreatureResponse)
async def play_creature(
    user_creature_id: str,
    body: UseItemRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_creature, item = await _consume_item(
        db, current_user, user_creature_id, body.item_id, "toy"
    )

    user_creature.happiness = min(100, user_creature.happiness + item.restore_amount)
    user_creature.hunger = max(0, user_creature.hunger - 5)
    if user_creature.happiness >= 90:
        user_creature.level += 1

    await db.commit()
    await db.refresh(user_creature)
    return user_creature
