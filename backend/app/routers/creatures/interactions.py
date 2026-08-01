"""Creature interaction routes: adopt, feed, play, sell/unlist."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.user import User
from ...models.user_creature import UserCreature
from ...schemas.creature import (
    AdoptRequest,
    ListForSaleRequest,
    UseItemRequest,
    UserCreatureResponse,
)
from ...services.creature_service import (
    adopt_creature,
    apply_feed_effect,
    apply_play_effect,
    consume_item,
    owned_creature,
)

router = APIRouter()


@router.post("/{creature_id}/adopt", response_model=UserCreatureResponse)
async def adopt_creature_route(
    creature_id: str,
    body: AdoptRequest = AdoptRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_creature = await adopt_creature(db, current_user, creature_id, body)
    await db.commit()
    await db.refresh(user_creature)
    return user_creature


@router.post("/{user_creature_id}/feed", response_model=UserCreatureResponse)
async def feed_creature(
    user_creature_id: str,
    body: UseItemRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_creature, item = await consume_item(
        db, current_user, user_creature_id, body.item_id, "food"
    )

    apply_feed_effect(user_creature, item, current_user)

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
    user_creature, item = await consume_item(
        db, current_user, user_creature_id, body.item_id, "toy"
    )

    apply_play_effect(user_creature, item, current_user)

    await db.commit()
    await db.refresh(user_creature)
    return user_creature


@router.post("/{user_creature_id}/sell", response_model=UserCreatureResponse)
async def list_for_sale(
    user_creature_id: str,
    body: ListForSaleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.price <= 0:
        raise HTTPException(status_code=400, detail="El precio debe ser mayor que 0")
    uc = await owned_creature(db, current_user, user_creature_id)
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
    uc = await owned_creature(db, current_user, user_creature_id)
    uc.for_sale = False
    uc.sale_price = None
    await db.commit()
    await db.refresh(uc)
    return uc
