"""Public pet item endpoints (inventory, buy). Admin CRUD lives in routers.admin.pet_items."""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models.pet_item import PetItem
from ..models.user_pet_item import UserPetItem
from ..models.user import User
from ..models.transaction import Transaction
from ..schemas.pet_item import (
    UserPetItemResponse,
)
from ..middleware.auth import get_current_user

router = APIRouter()


@router.get("/inventory", response_model=List[UserPetItemResponse])
async def my_inventory(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserPetItem).where(
            UserPetItem.user_id == current_user.id,
            UserPetItem.quantity > 0,
        )
    )
    return result.scalars().all()


@router.post("/{item_id}/buy", response_model=UserPetItemResponse)
async def buy_pet_item(
    item_id: str,
    quantity: int = Query(1, ge=1, le=99),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(PetItem).where(PetItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Pet item not found")

    total = item.price * quantity
    if current_user.zerines < total:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Not enough zerines. Need {total}, have {current_user.zerines}",
        )

    current_user.zerines -= total

    inv_result = await db.execute(
        select(UserPetItem).where(
            UserPetItem.user_id == current_user.id,
            UserPetItem.pet_item_id == item_id,
        )
    )
    inventory = inv_result.scalar_one_or_none()
    units = item.pack_size * quantity
    if inventory:
        inventory.quantity += units
    else:
        inventory = UserPetItem(
            user_id=current_user.id, pet_item_id=item_id, quantity=units
        )
        db.add(inventory)
    current_user.items_purchased = (current_user.items_purchased or 0) + units

    kind_label = "Comida" if item.kind == "food" else "Juguete"
    db.add(Transaction(
        sender_id=current_user.id,
        amount=total,
        type="purchase",
        description=f"{kind_label}: {item.name} x{quantity}",
        status="confirmed",
    ))

    await db.commit()
    await db.refresh(inventory)
    return inventory
