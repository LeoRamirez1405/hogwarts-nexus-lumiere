"""My-creatures routes: list my pets (with aging/decay) and the consolidated
full-state endpoint the pets page loads in one call."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.creature import Creature
from ...models.pet_item import PetItem
from ...models.user import User
from ...models.user_creature import UserCreature
from ...models.user_pet_item import UserPetItem
from ...schemas.creature import (
    MarketCreatureResponse,
    MyFullStateResponse,
    UserCreatureResponse,
)
from ...schemas.pagination import Page
from ...utils.magic_level import get_magic_level
from ...services.pet_service import (
    apply_aging_and_decay,
    compute_sanctuary_stats,
)

router = APIRouter()


async def _process_user_pets(db: AsyncSession, user: User) -> list[UserCreature]:
    """Apply aging/decay to all of the user's pets, removing the ones that
    retire or escape. Returns the list of surviving pets. Commits the session
    (the shared mutation the old flat router performed at the end)."""
    result = await db.execute(
        select(UserCreature).where(UserCreature.user_id == user.id)
    )
    creatures = result.scalars().all()
    alive = []
    for uc in creatures:
        if not await apply_aging_and_decay(db, uc, user):
            alive.append(uc)
    await db.commit()
    return alive


@router.get("/my", response_model=Page[UserCreatureResponse])
async def my_creatures(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alive = await _process_user_pets(db, current_user)
    total = len(alive)
    paged = alive[skip : skip + limit]
    has_more = (skip + limit) < total
    return Page(
        items=paged,
        total=total,
        skip=skip,
        limit=limit,
        has_more=has_more,
    )


@router.get("/my-full-state", response_model=MyFullStateResponse)
async def my_full_state(
    include_market: bool = Query(True),
    my_skip: int = Query(0, ge=0),
    my_limit: int = Query(50, ge=1, le=100),
    market_skip: int = Query(0, ge=0),
    market_limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Single-call consolidation of all state the pets page needs.

    Returns: creatures catalog, my creatures (with aging/decay applied),
    pet items catalog, my inventory, sanctuary stats, and (optionally)
    the creature market. `my_creatures` and `market` are server-side
    paginated (default limit 50) — load additional pages via /creatures/my
    and /creatures/market with the same `skip`/`limit` params.
    """
    # Creatures catalog (all, unpaginated — admin-controlled catalog, bounded)
    creatures_result = await db.execute(
        select(Creature).order_by(Creature.price).limit(100)
    )
    creatures = creatures_result.scalars().all()

    # My creatures — apply aging + decay exactly like /my endpoint,
    # then paginate the surviving list.
    alive = await _process_user_pets(db, current_user)
    my_total = len(alive)
    my_paged = alive[my_skip : my_skip + my_limit]
    my_has_more = (my_skip + my_limit) < my_total

    # Pet items catalog (admin-controlled and bounded, no pagination)
    items_result = await db.execute(
        select(PetItem).order_by(PetItem.pet_type, PetItem.kind, PetItem.price).limit(100)
    )
    pet_items = items_result.scalars().all()

    # My inventory (quantity > 0 — bounded by distinct pet items, no pagination)
    inv_result = await db.execute(
        select(UserPetItem).where(
            UserPetItem.user_id == current_user.id,
            UserPetItem.quantity > 0,
        )
    )
    inventory = inv_result.scalars().all()

    # Sanctuary stats (recompute after potential aging/decay commits above)
    magic = await get_magic_level(db, current_user)
    stats = compute_sanctuary_stats(current_user, alive, magic)

    # Market (optional + paginated)
    market = None
    market_total = None
    market_has_more = None
    if include_market:
        market_result = await db.execute(
            select(UserCreature, User)
            .join(User, User.id == UserCreature.user_id)
            .where(
                UserCreature.for_sale.is_(True),
                UserCreature.user_id != current_user.id,
            )
            .order_by(UserCreature.sale_price)
        )
        all_market = [
            MarketCreatureResponse(
                id=uc.id,
                creature=uc.creature,
                pet_name=uc.pet_name,
                level=uc.level,
                level_name=uc.level_name,
                stage=uc.stage,
                sale_price=uc.sale_price or 0,
                seller_id=seller.id,
                seller_name=seller.name,
            )
            for uc, seller in market_result.all()
        ]
        market_total = len(all_market)
        market = all_market[market_skip : market_skip + market_limit]
        market_has_more = (market_skip + market_limit) < market_total

    return MyFullStateResponse(
        creatures=creatures,
        my_creatures=my_paged,
        my_creatures_total=my_total,
        my_creatures_skip=my_skip,
        my_creatures_limit=my_limit,
        my_creatures_has_more=my_has_more,
        pet_items=pet_items,
        inventory=inventory,
        stats=stats,
        market=market,
        market_total=market_total,
        market_skip=market_skip if include_market else None,
        market_limit=market_limit if include_market else None,
        market_has_more=market_has_more,
    )
