"""Admin-only album CRUD: albums, cards, image URLs, activation."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.roles import require_role
from ...models.album import Album, AlbumCard, AlbumStatus
from ...models.user import User
from ...schemas.album import (
    AlbumCardCreate,
    AlbumCreate,
    AlbumDetailResponse,
    AlbumResponse,
    AlbumUpdate,
)
from ...services import album_service
from ...schemas.pagination import Page

router = APIRouter(prefix="/admin/albums", tags=["admin-albums"])


@router.get("", response_model=Page[AlbumResponse])
async def list_albums(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    query = select(Album)
    count_query = select(func.count(Album.id))
    if search:
        like = f"%{search}%"
        query = query.where(Album.name.ilike(like))
        count_query = count_query.where(Album.name.ilike(like))
    total = (await db.execute(count_query)).scalar_one()
    rows = (
        await db.execute(query.order_by(Album.created_at.desc()).offset(skip).limit(limit))
    ).scalars().all()
    items = []
    for album in rows:
        count = (await db.execute(select(func.count(AlbumCard.id)).where(AlbumCard.album_id == album.id))).scalar_one()
        items.append(album_service.album_response(album, count))
    return Page(items=items, total=total, skip=skip, limit=limit, has_more=skip + len(items) < total)


@router.get("/{album_id}", response_model=AlbumDetailResponse)
async def get_album(
    album_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    album = (await db.execute(select(Album).where(Album.id == album_id))).scalar_one_or_none()
    if album is None:
        raise HTTPException(status_code=404, detail="Album not found")
    return album_service.album_detail_response(album)


@router.post("", response_model=AlbumDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_album(
    data: AlbumCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    album = Album(
        name=data.name,
        description=data.description,
        cover_url=data.cover_url,
        status=AlbumStatus.DRAFT.value,
        starts_at=data.starts_at,
        ends_at=data.ends_at,
        created_by=current_user.id,
    )
    db.add(album)
    await db.flush()
    await _replace_cards(db, album.id, data.cards)
    await db.commit()
    return await _detail(db, album.id)


@router.put("/{album_id}", response_model=AlbumDetailResponse)
async def update_album(
    album_id: str,
    data: AlbumUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    album = (await db.execute(select(Album).where(Album.id == album_id))).scalar_one_or_none()
    if album is None:
        raise HTTPException(status_code=404, detail="Album not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(album, field, value)
    await db.commit()
    return await _detail(db, album_id)


@router.post("/{album_id}/cards", response_model=AlbumDetailResponse)
async def upsert_cards(
    album_id: str,
    cards: list[AlbumCardCreate],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """Reemplaza las cartas del album por lotes (25 slots) o actualiza las enviadas."""
    album = (await db.execute(select(Album).where(Album.id == album_id))).scalar_one_or_none()
    if album is None:
        raise HTTPException(status_code=404, detail="Album not found")
    existing = (
        await db.execute(select(AlbumCard).where(AlbumCard.album_id == album_id))
    ).scalars().all()
    by_slot = {card.slot_number: card for card in existing}
    for card_data in cards:
        if card_data.slot_number in by_slot:
            card = by_slot[card_data.slot_number]
            card.title = card_data.title if card_data.title is not None else card.title
            card.image_url = card_data.image_url if card_data.image_url is not None else card.image_url
            card.rarity = card_data.rarity
        else:
            db.add(
                AlbumCard(
                    album_id=album_id,
                    slot_number=card_data.slot_number,
                    title=card_data.title,
                    image_url=card_data.image_url,
                    rarity=card_data.rarity,
                )
            )
    await db.commit()
    return await _detail(db, album_id)


@router.delete("/{album_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_album(
    album_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    album = (await db.execute(select(Album).where(Album.id == album_id))).scalar_one_or_none()
    if album is None:
        raise HTTPException(status_code=404, detail="Album not found")
    await db.execute(delete(AlbumCard).where(AlbumCard.album_id == album_id))
    await db.delete(album)
    await db.commit()


async def _replace_cards(db: AsyncSession, album_id: str, cards: list[AlbumCardCreate]) -> None:
    for card_data in cards:
        db.add(
            AlbumCard(
                album_id=album_id,
                slot_number=card_data.slot_number,
                title=card_data.title,
                image_url=card_data.image_url,
                rarity=card_data.rarity,
            )
        )


async def _detail(db: AsyncSession, album_id: str) -> AlbumDetailResponse:
    album = (await db.execute(select(Album).where(Album.id == album_id))).scalar_one()
    await db.refresh(album)
    return album_service.album_detail_response(album)