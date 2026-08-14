"""Album rarity stats: how many users own each card ("la #13 solo la tienen 2")."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.album import Album, AlbumCard
from ...models.collection import UserCard
from ...models.user import User
from ...schemas.album import CardStat, CardStatsResponse

router = APIRouter()


@router.get("/{album_id}/card-stats", response_model=CardStatsResponse)
async def get_card_stats(
    album_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Duenos por carta: cuantas personas tienen cada figurita del album."""
    album = (
        await db.execute(select(Album).where(Album.id == album_id))
    ).scalar_one_or_none()
    if album is None:
        raise HTTPException(status_code=404, detail="Album not found")

    total_users = (
        await db.execute(select(func.count(func.distinct(UserCard.user_id))).where(UserCard.album_id == album_id))
    ).scalar_one()

    owner_rows = (
        await db.execute(
            select(UserCard.card_id, func.count(func.distinct(UserCard.user_id)))
            .where(UserCard.album_id == album_id)
            .group_by(UserCard.card_id)
        )
    ).all()
    owners_by_card = {card_id: count for card_id, count in owner_rows}

    cards = (
        await db.execute(
            select(AlbumCard).where(AlbumCard.album_id == album_id).order_by(AlbumCard.slot_number)
        )
    ).scalars().all()

    return CardStatsResponse(
        album_id=album_id,
        total_users=total_users,
        cards=[
            CardStat(
                card_id=card.id,
                slot_number=card.slot_number,
                title=card.title,
                rarity=card.rarity,
                owners=owners_by_card.get(card.id, 0),
                total_users=total_users,
            )
            for card in cards
        ],
    )