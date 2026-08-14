"""Player pack routes: store, tray, buy, open, and duplicate exchange."""

from datetime import datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..middleware.auth import get_current_user
from ..models.album import Album, AlbumStatus
from ..models.pack import PackOrigin, PackType, UserPack
from ..models.user import User
from ..notifications_service import N, notify
from ..schemas.pack import (
    BuyPackRequest,
    DailyPackStatus,
    ExchangeRequest,
    OpenPackResponse,
    OpenedCard,
    PackStoreResponse,
    UserPackResponse,
)
from ..services import pack_service
from app.utils.dates import utcnow

router = APIRouter()


def _utc_today() -> datetime:
    return datetime.combine(utcnow().date(), time.min)


@router.get("/daily", response_model=DailyPackStatus)
async def daily_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Estado del sobre diario gratis (UTC): disponible o cuando toca el proximo."""
    if current_user.last_daily_reward_at is None:
        return DailyPackStatus(available=True)
    next_claim = _utc_today() + timedelta(days=1)
    if current_user.last_daily_reward_at >= _utc_today():
        return DailyPackStatus(available=False, next_claim_at=next_claim)
    return DailyPackStatus(available=True)


@router.post("/daily", response_model=UserPackResponse, status_code=status.HTTP_201_CREATED)
async def claim_daily_pack(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sobre de Lechuza gratis, uno por dia (UTC, amarrado a daily_logins)."""
    if current_user.last_daily_reward_at is not None and current_user.last_daily_reward_at >= _utc_today():
        raise HTTPException(status_code=409, detail="Ya reclamaste tu sobre diario de hoy")

    album = (
        await db.execute(
            select(Album).where(Album.status == AlbumStatus.ACTIVE.value).order_by(Album.created_at.desc())
        )
    ).scalars().first()
    if album is None:
        raise HTTPException(status_code=404, detail="No hay un album activo")
    if await pack_service.is_completed(db, album.id, current_user.id):
        raise HTTPException(status_code=409, detail="Ya completaste este album")
    pack_type = await pack_service.cheapest_pack_type(db)
    if pack_type is None:
        raise HTTPException(status_code=404, detail="No hay tipos de sobre disponibles")

    pack = pack_service.create_pack(db, current_user.id, pack_type, album.id, origin=PackOrigin.DAILY.value)
    current_user.last_daily_reward_at = utcnow()
    await db.commit()
    await db.refresh(pack)
    await notify(
        db,
        user_id=current_user.id,
        type=N.DAILY_PACK,
        title="Sobre diario reclamado",
        body=f"Tu sobre de {pack_type.name} ya esta en la bandeja.",
        related_id=album.id,
        force=True,
    )
    return pack_service.user_pack_response(pack)


@router.get("", response_model=PackStoreResponse)
async def get_store(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pack_types = (
        await db.execute(select(PackType).where(PackType.enabled.is_(True)).order_by(PackType.price_zerines.asc()))
    ).scalars().all()
    tray = (
        await db.execute(
            select(UserPack)
            .where(UserPack.user_id == current_user.id, UserPack.opened.is_(False))
            .order_by(UserPack.created_at.asc())
        )
    ).scalars().all()
    return PackStoreResponse(
        pack_types=[pack_service.pack_type_response(pt) for pt in pack_types],
        tray=[pack_service.user_pack_response(p) for p in tray],
    )


@router.post("/buy", response_model=UserPackResponse, status_code=status.HTTP_201_CREATED)
async def buy_pack(
    data: BuyPackRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pack_type = (
        await db.execute(select(PackType).where(PackType.id == data.pack_type_id, PackType.enabled.is_(True)))
    ).scalar_one_or_none()
    if pack_type is None:
        raise HTTPException(status_code=404, detail="Tipo de sobre no encontrado")
    try:
        pack = await pack_service.buy_pack(db, current_user, pack_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return pack_service.user_pack_response(pack)


@router.post("/{pack_id}/open", response_model=OpenPackResponse)
async def open_pack(
    pack_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pack = (
        await db.execute(select(UserPack).where(UserPack.id == pack_id))
    ).scalar_one_or_none()
    if pack is None:
        raise HTTPException(status_code=404, detail="Sobre no encontrado")
    try:
        results, next_pity = await pack_service.open_pack(db, current_user, pack)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    cards = []
    for card, is_new, foil in results:
        cards.append(
            OpenedCard(
                card_id=card.id,
                slot_number=card.slot_number,
                title=card.title,
                image_url=card.image_url,
                rarity=card.rarity,
                is_new=is_new,
                foil=foil,
            )
        )
    return OpenPackResponse(
        pack_id=pack.id,
        pack_type_name=pack.pack_type.name,
        cards=cards,
        pity_progress=next_pity,
        pity_target=pack_service.PITY_TARGET,
    )


@router.post("/exchange", response_model=UserPackResponse, status_code=status.HTTP_201_CREATED)
async def exchange(
    data: ExchangeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        pack = await pack_service.exchange_duplicates(db, current_user, data.card_ids)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return pack_service.user_pack_response(pack)