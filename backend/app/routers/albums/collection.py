"""User collection routes: which cards a user owns in an album, with progress stats."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.album import Album, AlbumCard
from ...models.collection import UserCard
from ...models.user import User
from ...schemas.album import (
    AlbumCollectionResponse,
    CollectionCard,
    LeaderboardItem,
    LeaderboardResponse,
)
from ...services import album_service

router = APIRouter()


async def collection_for(
    db: AsyncSession,
    user_id: str,
    album: Album,
) -> AlbumCollectionResponse:
    rows = (
        await db.execute(
            select(UserCard).where(UserCard.user_id == user_id, UserCard.album_id == album.id)
        )
    ).scalars().all()
    by_card = {row.card_id: row for row in rows}

    total = (
        await db.execute(select(func.count(AlbumCard.id)).where(AlbumCard.album_id == album.id))
    ).scalar_one()

    owned = [
        CollectionCard(
            card_id=card.id,
            slot_number=card.slot_number,
            title=card.title,
            image_url=card.image_url,
            rarity=card.rarity,
            quantity=by_card[card.id].quantity,
        )
        for card in sorted(album.cards, key=lambda c: c.slot_number)
        if card.id in by_card
    ]

    progress = len(owned)
    duplicate_count = sum(row.quantity - 1 for row in by_card.values() if row.quantity > 1)
    return AlbumCollectionResponse(
        album=album_service.album_response(album, total),
        owned=owned,
        progress=progress,
        total=total,
        percent=round(progress * 100.0 / total, 1) if total else 0.0,
        duplicate_count=duplicate_count,
    )


@router.get("/{album_id}/collection", response_model=AlbumCollectionResponse)
async def get_my_collection(
    album_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    album = (
        await db.execute(select(Album).where(Album.id == album_id))
    ).scalar_one_or_none()
    if album is None:
        raise HTTPException(status_code=404, detail="Album not found")
    return await collection_for(db, current_user.id, album)


@router.get("/{album_id}/collection/{user_id}", response_model=AlbumCollectionResponse)
async def get_user_collection(
    album_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """El album de otro usuario (galeria social, `/albums/[userId]`)."""
    album = (
        await db.execute(select(Album).where(Album.id == album_id))
    ).scalar_one_or_none()
    if album is None:
        raise HTTPException(status_code=404, detail="Album not found")
    target = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    return await collection_for(db, user_id, album)


@router.get("/{album_id}/leaderboard", response_model=LeaderboardResponse)
async def album_leaderboard(
    album_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Top de coleccionistas por cantidad de figuritas distintas."""
    album = (
        await db.execute(select(Album).where(Album.id == album_id))
    ).scalar_one_or_none()
    if album is None:
        raise HTTPException(status_code=404, detail="Album not found")

    total = (
        await db.execute(select(func.count()).select_from(AlbumCard).where(AlbumCard.album_id == album_id))
    ).scalar_one()

    rows = (
        await db.execute(
            select(UserCard.user_id, func.count(distinct(UserCard.card_id)).label("owned"))
            .where(UserCard.album_id == album_id)
            .group_by(UserCard.user_id)
            .order_by(func.count(distinct(UserCard.card_id)).desc(), UserCard.user_id)
            .limit(12)
        )
    ).all()
    if not rows:
        return LeaderboardResponse(album_id=album_id, total_participants=0, entries=[])

    user_ids = [row[0] for row in rows]
    users = {
        u.id: u
        for u in (
            await db.execute(select(User).where(User.id.in_(user_ids)))
        ).scalars().all()
    }
    participants = (
        await db.execute(
            select(func.count(distinct(UserCard.user_id))).where(UserCard.album_id == album_id)
        )
    ).scalar_one()

    entries = [
        LeaderboardItem(
            user_id=row[0],
            name=users[row[0]].name if row[0] in users else "Desconocido",
            avatar_url=users[row[0]].avatar_url if row[0] in users else None,
            house=users[row[0]].house if row[0] in users else None,
            progress=row[1],
            percent=round(row[1] / total * 100, 1) if total else 0.0,
            first_completed=album.first_completed_by == row[0],
        )
        for row in rows
    ]
    return LeaderboardResponse(album_id=album_id, total_participants=participants, entries=entries)


@router.get("/{album_id}/duplicates", response_model=list[CollectionCard])
async def get_duplicates(
    album_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cartas con quantity >= 2 (candidatas al canje 3 -> 1 sobre)."""
    album = (
        await db.execute(select(Album).where(Album.id == album_id))
    ).scalar_one_or_none()
    if album is None:
        raise HTTPException(status_code=404, detail="Album not found")
    rows = (
        await db.execute(
            select(UserCard).where(
                UserCard.user_id == current_user.id,
                UserCard.album_id == album.id,
                UserCard.quantity >= 2,
            )
        )
    ).scalars().all()
    cards = {
        card.id: card
        for card in (
            await db.execute(select(AlbumCard).where(AlbumCard.album_id == album.id))
        ).scalars().all()
    }
    return [
        CollectionCard(
            card_id=row.card_id,
            slot_number=cards[row.card_id].slot_number,
            title=cards[row.card_id].title,
            image_url=cards[row.card_id].image_url,
            rarity=cards[row.card_id].rarity,
            quantity=row.quantity,
        )
        for row in rows
        if row.card_id in cards
    ]