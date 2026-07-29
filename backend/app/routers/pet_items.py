from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models.pet_item import PetItem
from ..models.user_pet_item import UserPetItem
from ..models.user import User
from ..models.transaction import Transaction
from ..schemas.pet_item import (
    PetItemCreate, PetItemUpdate, PetItemResponse, UserPetItemResponse,
)
from ..middleware.auth import get_current_user
from ..middleware.roles import require_role

router = APIRouter()

VALID_KINDS = {"food", "toy"}
VALID_PET_TYPES = {"Aves", "Bestias", "Criaturas pequeñas"}


@router.get("/", response_model=List[PetItemResponse])
async def list_pet_items(
    kind: Optional[str] = Query(None),
    pet_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(PetItem)
    if kind:
        query = query.where(PetItem.kind == kind)
    if pet_type:
        query = query.where(PetItem.pet_type == pet_type)
    query = query.order_by(PetItem.pet_type, PetItem.kind, PetItem.price)
    result = await db.execute(query)
    return result.scalars().all()


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


@router.post("/", response_model=PetItemResponse, status_code=status.HTTP_201_CREATED)
async def create_pet_item(
    data: PetItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    if data.kind not in VALID_KINDS:
        raise HTTPException(status_code=400, detail="Invalid kind (food/toy)")
    if data.pet_type not in VALID_PET_TYPES:
        raise HTTPException(status_code=400, detail="Invalid pet_type")
    item = PetItem(**data.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.put("/{item_id}", response_model=PetItemResponse)
async def update_pet_item(
    item_id: str,
    data: PetItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(PetItem).where(PetItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Pet item not found")
    payload = data.model_dump(exclude_unset=True)
    if "kind" in payload and payload["kind"] not in VALID_KINDS:
        raise HTTPException(status_code=400, detail="Invalid kind (food/toy)")
    if "pet_type" in payload and payload["pet_type"] not in VALID_PET_TYPES:
        raise HTTPException(status_code=400, detail="Invalid pet_type")
    for key, value in payload.items():
        setattr(item, key, value)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pet_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(PetItem).where(PetItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Pet item not found")
    # Remove any inventory rows referencing this item to avoid dangling refs.
    inv = await db.execute(
        select(UserPetItem).where(UserPetItem.pet_item_id == item_id)
    )
    for row in inv.scalars().all():
        await db.delete(row)
    await db.delete(item)
    await db.commit()
