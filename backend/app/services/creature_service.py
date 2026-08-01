"""Creature interaction logic: adopt, feed, play, market buy/sell.

Extracts the shared validation + effects the interactions router needs so the
endpoints stay thin and the rules are testable in isolation.
"""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.creature import Creature
from ..models.pet_item import PetItem
from ..models.user import User
from ..models.user_creature import UserCreature
from ..models.user_pet_item import UserPetItem
from ..schemas.creature import AdoptRequest
from .pet_service import check_requirements, settle_decay


async def adopt_creature(
    db: AsyncSession,
    current_user: User,
    creature_id: str,
    body: AdoptRequest,
):
    """Adopt a creature species: validate requirements + funds, transfer zerines,
    create the pet and log a purchase transaction. Does not commit."""
    from ..models.transaction import Transaction

    result = await db.execute(select(Creature).where(Creature.id == creature_id))
    creature = result.scalar_one_or_none()
    if not creature:
        raise HTTPException(status_code=404, detail="Creature not found")

    await check_requirements(db, current_user, creature)

    if current_user.zerines < creature.price:
        raise HTTPException(
            status_code=400,
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
            status_code=400,
            detail="You already own this creature",
        )

    raw_name = (body.pet_name or "").strip()
    pet_name = raw_name[:40] if raw_name else None

    current_user.zerines -= creature.price
    user_creature = UserCreature(
        user_id=current_user.id,
        creature_id=creature_id,
        pet_name=pet_name,
    )
    db.add(user_creature)

    transaction = Transaction(
        sender_id=current_user.id,
        amount=creature.price,
        type="purchase",
        description=f"Adopción: {creature.name}",
        status="confirmed",
    )
    db.add(transaction)
    return user_creature


async def consume_item(
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

    settle_decay(user_creature)
    inventory.quantity -= 1
    return user_creature, item


def apply_feed_effect(user_creature: UserCreature, item: PetItem, user: User) -> None:
    """Apply the restore/level-up effect of feeding, plus care bookkeeping."""
    user_creature.hunger = min(100, user_creature.hunger + item.restore_amount)
    user_creature.happiness = min(100, user_creature.happiness + 5)
    if (
        user_creature.hunger >= 80
        and user_creature.happiness >= 80
        and user_creature.level < UserCreature.MAX_LEVEL
    ):
        user_creature.level += 1
    user.care_actions += 1
    user_creature.attention_warned = False  # cared for → re-arm the reminder
    user_creature.escaped_warned = False
    user_creature.last_critical_at = None


def apply_play_effect(user_creature: UserCreature, item: PetItem, user: User) -> None:
    """Apply the restore/level-up effect of playing, plus care bookkeeping."""
    user_creature.happiness = min(100, user_creature.happiness + item.restore_amount)
    user_creature.hunger = max(0, user_creature.hunger - 5)
    if (
        user_creature.happiness >= 90
        and user_creature.level < UserCreature.MAX_LEVEL
    ):
        user_creature.level += 1
    user.care_actions += 1
    user_creature.attention_warned = False  # cared for → re-arm the reminder
    user_creature.escaped_warned = False
    user_creature.last_critical_at = None


async def owned_creature(
    db: AsyncSession,
    current_user: User,
    user_creature_id: str,
) -> UserCreature:
    result = await db.execute(
        select(UserCreature).where(
            UserCreature.id == user_creature_id,
            UserCreature.user_id == current_user.id,
        )
    )
    uc = result.scalar_one_or_none()
    if not uc:
        raise HTTPException(status_code=404, detail="You don't own this creature")
    return uc
