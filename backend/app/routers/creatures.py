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
from ..models.article_subscription import Notification
from ..schemas.creature import (
    CreatureCreate, CreatureResponse, UserCreatureResponse, UseItemRequest,
    MarketCreatureResponse, ListForSaleRequest, SanctuaryStats, AdoptRequest,
)
from ..middleware.auth import get_current_user
from ..middleware.roles import require_role
from ..utils.magic_level import get_magic_level
from .. import pet_progress
from ..notifications_service import N
from ..notifications_service import N

router = APIRouter()


async def _sanctuary_level_for(db: AsyncSession, user: User) -> int:
    pets = (await db.execute(
        select(UserCreature).where(UserCreature.user_id == user.id)
    )).scalars().all()
    score = pet_progress.sanctuary_score(
        len(pets),
        sum(p.level for p in pets),
        user.items_purchased or 0,
        user.care_actions or 0,
    )
    return pet_progress.sanctuary_level(score)


async def _check_requirements(db: AsyncSession, user: User, creature: Creature) -> None:
    """Raise 403 if the user doesn't meet a creature's level requirements."""
    req_user = creature.required_user_level or 1
    req_sanct = creature.required_sanctuary_level or 0
    if req_user <= 1 and req_sanct <= 0:
        return
    if req_user > 1:
        user_lvl = get_magic_level(user).get("level", 1)
        if user_lvl < req_user:
            raise HTTPException(
                status_code=403,
                detail=f"Necesitas Nivel Magico {req_user} (tienes {user_lvl})",
            )
    if req_sanct > 0:
        sanct_lvl = await _sanctuary_level_for(db, user)
        if sanct_lvl < req_sanct:
            raise HTTPException(
                status_code=403,
                detail=f"Necesitas nivel de santuario {req_sanct} (tienes {sanct_lvl})",
            )


async def _process_aging(db: AsyncSession, uc: UserCreature) -> bool:
    """Handle a pet's aging. Returns True if the pet was retired (removed).

    Sends a one-time farewell heads-up near end of life, and retires the pet
    with a farewell notification once its lifespan is exceeded. Does not commit.
    """
    name = uc.pet_name or (uc.creature.name if uc.creature else "Tu mascota")
    if pet_progress.pet_is_expired(uc.adopted_at):
        db.add(Notification(
            user_id=uc.user_id,
            type="pet_farewell",
            title="Una despedida",
            body=f"{name} ha vivido una larga y feliz vida en tu santuario, y hoy parte en paz. Gracias por cuidarla.",
            related_id=uc.creature_id,
        ))
        await db.delete(uc)
        return True
    if not uc.farewell_warned and pet_progress.pet_needs_farewell_warning(uc.adopted_at):
        db.add(Notification(
            user_id=uc.user_id,
            type="pet_aging",
            title="Tu mascota esta muy ancianita",
            body=f"{name} ya es muy mayor. Disfruta y cuida bien sus ultimos dias.",
            related_id=uc.creature_id,
        ))
        uc.farewell_warned = True
    return False


def _settle_decay(uc: UserCreature) -> bool:
    """Apply elapsed-time hunger/happiness decay in place (clamped at 0).

    Idempotent per call: advances `last_decay_at` to now. Safe to call before
    any read or mutation so stored stats always reflect the current moment.

    Also handles:
    - Attention warning when either stat ≤ 20
    - Escape warning when either stat hits 0
    - Escape when either stat stays at 0 for PET_ESCAPE_GRACE_HOURS

    Returns True if pet escaped.
    """
    now = datetime.utcnow()
    last = uc.last_decay_at or uc.adopted_at or now
    hours = (now - last).total_seconds() / 3600.0
    if hours <= 0:
        uc.last_decay_at = now
        return False
    hunger_loss = hours * settings.HUNGER_DECAY_PER_HOUR
    happiness_loss = hours * settings.HAPPINESS_DECAY_PER_HOUR
    uc.hunger = max(0, int(round(uc.hunger - hunger_loss)))
    uc.happiness = max(0, int(round(uc.happiness - happiness_loss)))

    # Attention warning: either stat ≤ 20
    if pet_progress.pet_needs_attention_warning(uc):
        uc.attention_warned = True

    # Escape warning: either stat hit 0
    if pet_progress.pet_needs_escape_warning(uc):
        uc.escaped_warned = True
        if uc.last_critical_at is None:
            uc.last_critical_at = now

    # Escape: either stat at 0 for grace period
    if pet_progress.pet_should_escape(uc):
        return True

    uc.last_decay_at = now
    return False


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
    alive = []
    for uc in creatures:
        retired = await _process_aging(db, uc)
        if retired:
            continue
        escaped = _settle_decay(uc)
        if escaped:
            name = uc.pet_name or (uc.creature.name if uc.creature else "Tu mascota")
            db.add(Notification(
                user_id=uc.user_id,
                type=N.PET_ESCAPED,
                title="Tu mascota se ha escapado",
                body=f"{name} ha aprovechado un descuido y ha salido corriendo. Se ha ido para siempre.",
                related_id=uc.creature_id,
            ))
            await db.delete(uc)
            continue
        alive.append(uc)
    await db.commit()
    return alive


@router.get("/stats", response_model=SanctuaryStats)
async def sanctuary_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sanctuary level (0-23, from the whole sanctuary) + the user's own level.

    The user level is the existing profile "magic level" (1-11), independent of
    the pets; it is surfaced here only so the pets page can show and celebrate it.
    """
    pets = (await db.execute(
        select(UserCreature).where(UserCreature.user_id == current_user.id)
    )).scalars().all()
    pets_count = len(pets)
    levels_sum = sum(p.level for p in pets)

    care = current_user.care_actions or 0
    bought = current_user.items_purchased or 0

    s_score = pet_progress.sanctuary_score(pets_count, levels_sum, bought, care)
    s_level = pet_progress.sanctuary_level(s_score)

    magic = get_magic_level(current_user)

    return SanctuaryStats(
        sanctuary_level=s_level,
        sanctuary_score=s_score,
        sanctuary_max=pet_progress.MAX_SANCTUARY_LEVEL,
        sanctuary_progress=pet_progress.level_progress(
            s_score, s_level, pet_progress.MAX_SANCTUARY_LEVEL, base=4.0
        ),
        user_level=magic.get("level", 1),
        user_level_name=magic.get("name", ""),
        user_level_max=11,
        user_progress=float(magic.get("progress", 0.0)),
        pets_count=pets_count,
    )


@router.get("/market", response_model=List[MarketCreatureResponse])
async def creature_market(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pets other users have listed for sale."""
    result = await db.execute(
        select(UserCreature, User)
        .join(User, User.id == UserCreature.user_id)
        .where(
            UserCreature.for_sale.is_(True),
            UserCreature.user_id != current_user.id,
        )
        .order_by(UserCreature.sale_price)
    )
    listings = []
    for uc, seller in result.all():
        listings.append(MarketCreatureResponse(
            id=uc.id,
            creature=uc.creature,
            pet_name=uc.pet_name,
            level=uc.level,
            level_name=uc.level_name,
            stage=uc.stage,
            sale_price=uc.sale_price or 0,
            seller_id=seller.id,
            seller_name=seller.name,
        ))
    return listings


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
    body: AdoptRequest = AdoptRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Creature).where(Creature.id == creature_id))
    creature = result.scalar_one_or_none()
    if not creature:
        raise HTTPException(status_code=404, detail="Creature not found")

    await _check_requirements(db, current_user, creature)

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
    if (
        user_creature.hunger >= 80
        and user_creature.happiness >= 80
        and user_creature.level < UserCreature.MAX_LEVEL
    ):
        user_creature.level += 1
    current_user.care_actions += 1
    user_creature.attention_warned = False  # cared for → re-arm the reminder
    user_creature.escaped_warned = False
    user_creature.last_critical_at = None

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
    if (
        user_creature.happiness >= 90
        and user_creature.level < UserCreature.MAX_LEVEL
    ):
        user_creature.level += 1
    current_user.care_actions += 1
    user_creature.attention_warned = False  # cared for → re-arm the reminder
    user_creature.escaped_warned = False
    user_creature.last_critical_at = None

    await db.commit()
    await db.refresh(user_creature)
    return user_creature


async def _owned_creature(db, current_user, user_creature_id) -> UserCreature:
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


@router.post("/{user_creature_id}/sell", response_model=UserCreatureResponse)
async def list_for_sale(
    user_creature_id: str,
    body: ListForSaleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.price <= 0:
        raise HTTPException(status_code=400, detail="El precio debe ser mayor que 0")
    uc = await _owned_creature(db, current_user, user_creature_id)
    uc.for_sale = True
    uc.sale_price = body.price
    await db.commit()
    await db.refresh(uc)
    return uc


@router.delete("/{user_creature_id}/sell", response_model=UserCreatureResponse)
async def unlist_from_sale(
    user_creature_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    uc = await _owned_creature(db, current_user, user_creature_id)
    uc.for_sale = False
    uc.sale_price = None
    await db.commit()
    await db.refresh(uc)
    return uc


@router.post("/market/{user_creature_id}/buy", response_model=UserCreatureResponse)
async def buy_from_market(
    user_creature_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserCreature).where(UserCreature.id == user_creature_id)
    )
    uc = result.scalar_one_or_none()
    if not uc or not uc.for_sale:
        raise HTTPException(status_code=404, detail="Esta mascota no esta a la venta")
    if uc.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Ya es tu mascota")

    if uc.creature:
        await _check_requirements(db, current_user, uc.creature)

    price = uc.sale_price or 0
    if current_user.zerines < price:
        raise HTTPException(
            status_code=400,
            detail=f"No tienes suficientes zerines. Necesitas {price}, tienes {current_user.zerines}",
        )

    seller = (await db.execute(
        select(User).where(User.id == uc.user_id)
    )).scalar_one_or_none()

    # Transfer funds and ownership.
    current_user.zerines -= price
    if seller:
        seller.zerines += price
    former_owner_id = uc.user_id
    uc.user_id = current_user.id
    uc.for_sale = False
    uc.sale_price = None

    creature_name = uc.creature.name if uc.creature else "una mascota"
    db.add(Transaction(
        sender_id=current_user.id,
        receiver_id=former_owner_id,
        amount=price,
        type="purchase",
        description=f"Compra de mascota: {creature_name}",
        status="confirmed",
    ))
    db.add(Notification(
        user_id=former_owner_id,
        type="pet_sold",
        title="Vendiste una mascota",
        body=f"{current_user.name} compro a {creature_name} por {price} zerines.",
        related_id=uc.creature_id,
    ))

    await db.commit()
    await db.refresh(uc)
    return uc
