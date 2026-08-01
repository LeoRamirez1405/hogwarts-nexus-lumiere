"""Creature market routes: list pets for sale + buy one."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.transaction import Transaction
from ...models.user import User
from ...models.user_creature import UserCreature
from ...schemas.creature import MarketCreatureResponse, UserCreatureResponse
from ...schemas.pagination import Page
from ...services.pet_service import check_requirements
from ...services.notification_templates import pet_sold

router = APIRouter()


@router.get("/market", response_model=Page[MarketCreatureResponse])
async def creature_market(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pets other users have listed for sale. Paginated server-side."""
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
    total = len(listings)
    paged = listings[skip : skip + limit]
    has_more = (skip + limit) < total
    return Page(
        items=paged,
        total=total,
        skip=skip,
        limit=limit,
        has_more=has_more,
    )


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
        await check_requirements(db, current_user, uc.creature)

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
    db.add(pet_sold(
        former_owner_id=former_owner_id,
        buyer_name=current_user.name,
        creature_name=creature_name,
        price=price,
        creature_id=uc.creature_id,
    ))

    await db.commit()
    await db.refresh(uc)
    return uc
