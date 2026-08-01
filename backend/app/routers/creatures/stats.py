"""Sanctuary stats route."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.user import User
from ...models.user_creature import UserCreature
from ...schemas.creature import SanctuaryStats
from ...utils.magic_level import get_magic_level
from ...services.pet_service import compute_sanctuary_stats

router = APIRouter()


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

    magic = await get_magic_level(db, current_user)

    return SanctuaryStats(**compute_sanctuary_stats(current_user, pets, magic))
