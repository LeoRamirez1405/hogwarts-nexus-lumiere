"""Background pet-care sweep: notify owners when a pet needs attention.

Hunger/happiness decay lazily (settled on read), so a pet left alone would only
"complain" the next time its owner opens the sanctuary. This sweep runs on a
timer and proactively pings the owner once per lapse when a pet's hunger or
happiness has fallen to/below the configured threshold. The one-shot
``attention_warned`` flag (reset when the owner feeds/plays) prevents repeats.
"""

import asyncio

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from .database import async_session
from .config import settings
from .models.user_creature import UserCreature
from .notifications_service import notify, N
from .routers.creatures import _settle_decay


async def sweep_pet_care() -> dict:
    """Settle decay for every live pet and notify owners of neglected ones once."""
    warned = 0
    async with async_session() as db:
        pets = (
            await db.execute(
                select(UserCreature).options(selectinload(UserCreature.creature))
            )
        ).scalars().all()

        for uc in pets:
            _settle_decay(uc)
            neglected = (
                uc.hunger <= settings.PET_ATTENTION_HUNGER
                or uc.happiness <= settings.PET_ATTENTION_HAPPINESS
            )
            if neglected and not uc.attention_warned:
                name = uc.creature.name if uc.creature else "Tu mascota"
                reason = "tiene hambre" if uc.hunger <= settings.PET_ATTENTION_HUNGER else "está triste"
                await notify(
                    db,
                    user_id=uc.user_id,
                    type=N.PET_NEEDS_ATTENTION,
                    title=f"{name} necesita atención",
                    body=f"{name} {reason}. Pásate por el santuario a cuidarla.",
                    related_id=uc.creature_id,
                )
                uc.attention_warned = True
                warned += 1

        await db.commit()
    return {"warned": warned}


async def pet_care_loop():
    """Background loop: sweep now, then every ``PET_CARE_SWEEP_HOURS``."""
    interval = max(1, settings.PET_CARE_SWEEP_HOURS) * 3600
    while True:
        try:
            result = await sweep_pet_care()
            if result.get("warned"):
                print(f"[pet_care] warned {result['warned']} owners")
        except Exception as exc:  # never let the loop die
            print(f"[pet_care] sweep failed: {exc}")
        await asyncio.sleep(interval)
