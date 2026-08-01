"""Pet lifecycle + sanctuary logic (aging, decay, leveling, sanctuary score).

Centralizes the pure-ish helpers the creatures routers used to duplicate across
``/my`` and ``/my-full-state`` so every endpoint applies the same rules.
"""

from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.creature import Creature
from ..models.user import User
from ..models.user_creature import UserCreature
from .. import pet_progress
from ..utils.magic_level import get_magic_level
from .notification_templates import (
    pet_aging_warning,
    pet_escaped,
    pet_farewell,
)


async def sanctuary_level_for(db: AsyncSession, user: User) -> int:
    pets = (await db.execute(
        select(UserCreature).where(UserCreature.user_id == user.id)
    )).scalars().all()
    score = pet_progress.sanctuary_score(
        len(pets),
        sum(p.level for p in pets),
        user.items_purchased or 0,
        user.care_actions or 0,
        user.sanctuary_penalty or 0,
    )
    return pet_progress.sanctuary_level(score)


async def check_requirements(db: AsyncSession, user: User, creature: Creature) -> None:
    """Raise 403 if the user doesn't meet a creature's level requirements."""
    req_user = creature.required_user_level or 1
    req_sanct = creature.required_sanctuary_level or 0
    if req_user <= 1 and req_sanct <= 0:
        return
    if req_user > 1:
        user_lvl = (await get_magic_level(db, user)).get("level", 1)
        if user_lvl < req_user:
            raise HTTPException(
                status_code=403,
                detail=f"Necesitas Nivel Mágico {req_user} (tienes {user_lvl})",
            )
    if req_sanct > 0:
        sanct_lvl = await sanctuary_level_for(db, user)
        if sanct_lvl < req_sanct:
            raise HTTPException(
                status_code=403,
                detail=f"Necesitas nivel de santuario {req_sanct} (tienes {sanct_lvl})",
            )


async def process_aging(db: AsyncSession, uc: UserCreature) -> bool:
    """Handle a pet's aging. Returns True if the pet was retired (removed).

    Sends a one-time farewell heads-up near end of life, and retires the pet
    with a farewell notification once its lifespan is exceeded. Does not commit.
    """
    name = uc.pet_name or (uc.creature.name if uc.creature else "Tu mascota")
    if pet_progress.pet_is_expired(uc.adopted_at):
        db.add(pet_farewell(uc.user_id, uc.creature_id, name))
        # Apply death penalty to sanctuary score
        if uc.creature:
            penalty = pet_progress.death_penalty(uc.level, uc.creature.rarity)
            user = await db.get(User, uc.user_id)
            if user:
                user.sanctuary_penalty = (user.sanctuary_penalty or 0) + penalty
        await db.delete(uc)
        return True
    if not uc.farewell_warned and pet_progress.pet_needs_farewell_warning(uc.adopted_at):
        db.add(pet_aging_warning(uc.user_id, uc.creature_id, name))
        uc.farewell_warned = True
    return False


def settle_decay(uc: UserCreature) -> bool:
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


async def settle_escaped_pet(
    db: AsyncSession,
    uc: UserCreature,
    owner: User,
) -> None:
    """Apply the escape penalty + farewell notification for an escaped pet and
    remove it. Does not commit (the caller commits the whole batch)."""
    name = uc.pet_name or (uc.creature.name if uc.creature else "Tu mascota")
    # Apply escape penalty to sanctuary score
    if uc.creature:
        penalty = pet_progress.escape_penalty(uc.level, uc.creature.rarity)
        owner.sanctuary_penalty = (owner.sanctuary_penalty or 0) + penalty
    db.add(pet_escaped(uc.user_id, uc.creature_id, name))
    await db.delete(uc)


async def apply_aging_and_decay(
    db: AsyncSession,
    uc: UserCreature,
    owner: User,
) -> bool:
    """Run aging + decay for one pet. Returns True if the pet no longer exists
    (retired or escaped) and was removed from the session."""
    retired = await process_aging(db, uc)
    if retired:
        return True
    escaped = settle_decay(uc)
    if escaped:
        await settle_escaped_pet(db, uc, owner)
        return True
    return False


def compute_sanctuary_stats(
    user: User,
    pets: list,
    magic: dict,
) -> dict:
    """Compute the SanctuaryStats payload fields (level/score/progress + user
    magic level) from the current pets and user counters."""
    pets_count = len(pets)
    levels_sum = sum(p.level for p in pets)
    care = user.care_actions or 0
    bought = user.items_purchased or 0
    penalty = user.sanctuary_penalty or 0

    s_score = pet_progress.sanctuary_score(pets_count, levels_sum, bought, care, penalty)
    s_level = pet_progress.sanctuary_level(s_score)

    return {
        "sanctuary_level": s_level,
        "sanctuary_score": s_score,
        "sanctuary_max": pet_progress.MAX_SANCTUARY_LEVEL,
        "sanctuary_progress": pet_progress.level_progress(
            s_score, s_level, pet_progress.MAX_SANCTUARY_LEVEL, base=4.0
        ),
        "user_level": magic.get("level", 1),
        "user_level_name": magic.get("name", ""),
        "user_level_max": 11,
        "user_progress": float(magic.get("progress", 0.0)),
        "pets_count": pets_count,
        "sanctuary_penalty": penalty,
    }
