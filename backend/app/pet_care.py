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
from .models.user import User
from .models.user_creature import UserCreature
from .notifications_service import notify, N
from .services.pet_service import settle_decay, settle_escaped_pet


async def sweep_pet_care() -> dict:
    """Settle decay for every live pet and notify owners of neglected ones once.

    ``settle_decay`` arms the one-shot ``attention_warned``/``escaped_warned``
    flags, so this sweep must snapshot them BEFORE settling to detect the
    transition — otherwise the flag would already be ``True`` and the warning
    would never be sent. Escapes are retired proactively here too, because a
    neglected pet must not disappear silently until its owner happens to open
    the app.
    """
    warned = 0
    escaped = 0
    async with async_session() as db:
        pets = (
            await db.execute(
                select(UserCreature).options(selectinload(UserCreature.creature))
            )
        ).scalars().all()

        for uc in pets:
            name = uc.pet_name or (uc.creature.name if uc.creature else "Tu mascota")
            attention_armed = uc.attention_warned
            escape_armed = uc.escaped_warned

            if settle_decay(uc):
                owner = await db.get(User, uc.user_id)
                if owner is not None:
                    await settle_escaped_pet(db, uc, owner)
                escaped += 1
                continue

            if uc.attention_warned and not attention_armed:
                reason = "tiene hambre" if uc.hunger <= settings.PET_ATTENTION_HUNGER else "esta triste"
                await notify(
                    db,
                    user_id=uc.user_id,
                    type=N.PET_NEEDS_ATTENTION,
                    title=f"{name} necesita atención",
                    body=f"{name} {reason}. Pásate por el santuario a cuidarla.",
                    related_id=uc.creature_id,
                )
                warned += 1
            if uc.escaped_warned and not escape_armed:
                await notify(
                    db,
                    user_id=uc.user_id,
                    type=N.PET_ESCAPE_WARNING,
                    title=f"{name} está a punto de escapar",
                    body=f"{name} está en números rojos. Vuelve a alimentarla o "
                    "jugar con ella antes de que se escape para siempre.",
                    related_id=uc.creature_id,
                )
                warned += 1

        await db.commit()
    return {"warned": warned, "escaped": escaped}


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
