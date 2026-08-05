"""Creature catalog routes: single-creature reads (public).

The admin CRUD (list/create/update/delete) lives in routers.admin.creatures.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.creature import Creature
from ...models.user import User
from ...schemas.creature import CreatureResponse

router = APIRouter()


@router.get("/{creature_id}", response_model=CreatureResponse)
async def get_creature(
    creature_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Creature).where(Creature.id == creature_id))
    creature = result.scalar_one_or_none()
    if not creature:
        raise HTTPException(status_code=404, detail="Creature not found")
    return creature
