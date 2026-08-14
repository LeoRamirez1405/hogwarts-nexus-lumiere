"""Admin-only PackType CRUD (sobres: precio, cartas, pesos de rareza)."""

import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.roles import require_role
from ...models.pack import PackType
from ...models.user import User
from ...schemas.pack import PackTypeCreate, PackTypeResponse, PackTypeUpdate
from ...schemas.pagination import Page
from ...services import pack_service

router = APIRouter(prefix="/admin/packs", tags=["admin-packs"])


@router.get("", response_model=Page[PackTypeResponse])
async def list_pack_types(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    total = (await db.execute(select(func.count(PackType.id)))).scalar_one()
    rows = (
        await db.execute(select(PackType).order_by(PackType.price_zerines.asc()).offset(skip).limit(limit))
    ).scalars().all()
    items = [pack_service.pack_type_response(pt) for pt in rows]
    return Page(items=items, total=total, skip=skip, limit=limit, has_more=skip + len(items) < total)


@router.post("", response_model=PackTypeResponse, status_code=status.HTTP_201_CREATED)
async def create_pack_type(
    data: PackTypeCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    pack_type = PackType(
        name=data.name,
        description=data.description,
        price_zerines=data.price_zerines,
        num_cards=data.num_cards,
        rarity_weights=json.dumps(data.rarity_weights) if data.rarity_weights else None,
        enabled=data.enabled,
    )
    db.add(pack_type)
    await db.commit()
    await db.refresh(pack_type)
    return pack_service.pack_type_response(pack_type)


@router.put("/{pack_type_id}", response_model=PackTypeResponse)
async def update_pack_type(
    pack_type_id: str,
    data: PackTypeUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    pack_type = (await db.execute(select(PackType).where(PackType.id == pack_type_id))).scalar_one_or_none()
    if pack_type is None:
        raise HTTPException(status_code=404, detail="Pack type not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "rarity_weights":
            value = json.dumps(value) if value else None
        setattr(pack_type, field, value)
    await db.commit()
    await db.refresh(pack_type)
    return pack_service.pack_type_response(pack_type)


@router.delete("/{pack_type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pack_type(
    pack_type_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    pack_type = (await db.execute(select(PackType).where(PackType.id == pack_type_id))).scalar_one_or_none()
    if pack_type is None:
        raise HTTPException(status_code=404, detail="Pack type not found")
    await db.delete(pack_type)
    await db.commit()