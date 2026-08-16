"""Creature catalog routes: single-creature reads (public).

The admin CRUD (list/create/update/delete) lives in routers.admin.creatures.
"""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...cache import cache_get, cache_set
from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.creature import Creature
from ...models.user import User
from ...schemas.creature import CreatureResponse

router = APIRouter()

_CREATURE_TTL = 300


@router.get("/{creature_id}", response_model=CreatureResponse)
async def get_creature(
    creature_id: str,
    response: Response,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    cache_key = f"creatures:{creature_id}"
    cached = cache_get(cache_key)
    if cached is not None:
        response.headers["Cache-Control"] = f"private, max-age={_CREATURE_TTL}"
        return cached
    result = await db.execute(select(Creature).where(Creature.id == creature_id))
    creature = result.scalar_one_or_none()
    if not creature:
        raise HTTPException(status_code=404, detail="Creature not found")
    payload = CreatureResponse.model_validate(creature)
    cache_set(cache_key, payload, _CREATURE_TTL)
    response.headers["Cache-Control"] = f"private, max-age={_CREATURE_TTL}"
    return payload
