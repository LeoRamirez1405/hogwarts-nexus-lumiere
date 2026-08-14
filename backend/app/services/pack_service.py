"""Motor del album de figuritas: probabilidades, piedad, apertura y canje.

Un servicio = un dominio (Regla #12). Toda la logica de sobres vive aqui;
los routers solo validan auth y llaman a estas funciones.
"""

import json
import random
from typing import Dict, List, Optional, Tuple

from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.album import Album, AlbumCard, AlbumStatus, CardRarity
from ..models.collection import UserAlbumCompletion, UserCard
from ..models.pack import PackOrigin, PackType, UserPack
from ..models.transaction import Transaction
from ..models.user import User
from ..notifications_service import N, notify
from app.utils.dates import utcnow

# Sobres abiertos sin legendary tras los cuales el siguiente garantiza una.
PITY_TARGET = 20

# Premio unico al primer jugador que complete el album.
FIRST_COMPLETION_PRIZE = 500

# Probabilidad de que una carta abierta salga en su variante foil dorada (1%).
FOIL_CHANCE = 0.01

# Insignia del primer completador (modelo UserBadge).
FIRST_COMPLETER_BADGE_KEY = "first_completer"
FIRST_COMPLETER_BADGE_LABEL = "Primer Completador"
FIRST_COMPLETER_BADGE_ICON = "military_tech"

DEFAULT_WEIGHTS: Dict[str, int] = {
    CardRarity.COMMON.value: 55,
    CardRarity.RARE.value: 25,
    CardRarity.ULTRA_RARE.value: 12,
    CardRarity.SPECIAL.value: 6,
    CardRarity.LEGENDARY.value: 2,
}

RARITY_ORDER = [
    CardRarity.LEGENDARY.value,
    CardRarity.SPECIAL.value,
    CardRarity.ULTRA_RARE.value,
    CardRarity.RARE.value,
    CardRarity.COMMON.value,
]


def parse_weights(pack_type: PackType) -> Dict[str, int]:
    """Pesos del PackType; si no vienen, usa los default."""
    if not pack_type.rarity_weights:
        return dict(DEFAULT_WEIGHTS)
    try:
        weights = json.loads(pack_type.rarity_weights)
    except (ValueError, TypeError):
        return dict(DEFAULT_WEIGHTS)
    return {k: int(v) for k, v in weights.items() if int(v) > 0}


def pick_rarity(weights: Dict[str, int]) -> str:
    rarities = list(weights.keys())
    probs = [weights[r] for r in rarities]
    return random.choices(rarities, weights=probs, k=1)[0]


async def active_album(db: AsyncSession) -> Optional[Album]:
    result = await db.execute(
        select(Album).where(Album.status == AlbumStatus.ACTIVE.value).order_by(Album.starts_at.desc()).limit(1)
    )
    return result.scalar_one_or_none()


def pack_type_response(pack_type: PackType):
    from ..schemas.pack import PackTypeResponse

    data = {k: v for k, v in pack_type.__dict__.items() if not k.startswith("_") and k != "rarity_weights"}
    return PackTypeResponse(**data, rarity_weights=parse_weights(pack_type))


def user_pack_response(pack: UserPack):
    from ..schemas.pack import UserPackResponse

    return UserPackResponse(
        id=pack.id,
        pack_type_id=pack.pack_type_id,
        pack_type_name=pack.pack_type.name,
        album_id=pack.album_id,
        album_name=pack.album.name if pack.album else "",
        origin=pack.origin,
        opened=pack.opened,
        created_at=pack.created_at,
    )


async def cheapest_pack_type(db: AsyncSession) -> Optional[PackType]:
    result = await db.execute(
        select(PackType).where(PackType.enabled.is_(True)).order_by(PackType.price_zerines.asc()).limit(1)
    )
    return result.scalar_one_or_none()


async def _cards_by_rarity(db: AsyncSession, album_id: str) -> Dict[str, List[AlbumCard]]:
    result = await db.execute(select(AlbumCard).where(AlbumCard.album_id == album_id))
    cards: Dict[str, List[AlbumCard]] = {}
    for card in result.scalars().all():
        cards.setdefault(card.rarity, []).append(card)
    return cards


async def is_completed(db: AsyncSession, album_id: str, user_id: str) -> bool:
    """El usuario ya posee todas las cartas distintas del album."""
    owned = (
        await db.execute(
            select(func.count(distinct(UserCard.card_id))).where(
                UserCard.user_id == user_id, UserCard.album_id == album_id
            )
        )
    ).scalar_one()
    total = (
        await db.execute(select(func.count()).select_from(AlbumCard).where(AlbumCard.album_id == album_id))
    ).scalar_one()
    return total > 0 and owned >= total


async def _require_not_completed(db: AsyncSession, album_id: str, user_id: str) -> None:
    if await is_completed(db, album_id, user_id):
        raise ValueError("Ya completaste este album: no puedes obtener mas sobres")


async def _grant_first_completer_badge(db: AsyncSession, user_id: str) -> None:
    from ..models.badge import UserBadge

    existing = (
        await db.execute(
            select(UserBadge).where(
                UserBadge.user_id == user_id,
                UserBadge.badge_key == FIRST_COMPLETER_BADGE_KEY,
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        db.add(
            UserBadge(
                user_id=user_id,
                badge_key=FIRST_COMPLETER_BADGE_KEY,
                label=FIRST_COMPLETER_BADGE_LABEL,
                icon=FIRST_COMPLETER_BADGE_ICON,
            )
        )


async def _handle_completion(db: AsyncSession, album_id: str, user_id: str) -> bool:
    """Limpieza y premios al completar el album (misma transaccion, flush previo).

    Para CUALQUIER completador: se eliminan los sobres sin abrir de esa edicion
    y las copias duplicadas (quantity -> 1). Solo el PRIMER completador recibe
    bote de Zerines, insignia y titulo oficial.
    """
    album = (await db.execute(select(Album).where(Album.id == album_id))).scalar_one_or_none()
    if album is None or not await is_completed(db, album_id, user_id):
        return False

    existing_completion = (
        await db.execute(
            select(UserAlbumCompletion).where(
                UserAlbumCompletion.user_id == user_id,
                UserAlbumCompletion.album_id == album_id,
            )
        )
    ).scalar_one_or_none()
    if existing_completion is None:
        db.add(UserAlbumCompletion(user_id=user_id, album_id=album_id))

    packs = (
        await db.execute(
            select(UserPack).where(
                UserPack.user_id == user_id,
                UserPack.album_id == album_id,
                UserPack.opened.is_(False),
            )
        )
    ).scalars().all()
    for pack in packs:
        await db.delete(pack)
    rows = (
        await db.execute(
            select(UserCard).where(UserCard.user_id == user_id, UserCard.album_id == album_id)
        )
    ).scalars().all()
    for row in rows:
        row.quantity = 1

    is_first = album.first_completed_by is None
    if is_first:
        album.first_completed_by = user_id
        album.first_completed_at = utcnow()
        user = (await db.execute(select(User).where(User.id == user_id))).scalar_one()
        user.zerines += FIRST_COMPLETION_PRIZE
        db.add(
            Transaction(
                receiver_id=user_id,
                amount=FIRST_COMPLETION_PRIZE,
                type="reward",
                description=f'Primer completador del album "{album.name}"',
                status="confirmed",
            )
        )
        if not user.official_title:
            user.official_title = "Primer Completador"
        await _grant_first_completer_badge(db, user_id)
        await notify(
            db,
            user_id=user_id,
            type=N.ALBUM_COMPLETED,
            title="Album completado",
            body=(
                f'¡Completaste "{album.name}" y eres el primero! '
                f"+{FIRST_COMPLETION_PRIZE} zerines."
            ),
            related_id=album_id,
            force=True,
        )
    else:
        await notify(
            db,
            user_id=user_id,
            type=N.ALBUM_COMPLETED,
            title="Album completado",
            body=f'¡Completaste "{album.name}"! Ya no puedes comprar mas sobres de esta edicion.',
            related_id=album_id,
            force=True,
        )
    return True


async def _pity_progress(db: AsyncSession, user_id: str) -> int:
    """Sobres abiertos consecutivos sin legendary desde la ultima que salio."""
    result = await db.execute(
        select(UserPack.opened_at, UserPack.result_json)
        .where(UserPack.user_id == user_id, UserPack.opened.is_(True))
        .order_by(UserPack.opened_at.desc())
    )
    progress = 0
    for _, result_json in result.all():
        if not result_json:
            continue
        try:
            cards = json.loads(result_json)
        except (ValueError, TypeError):
            continue
        if any(c.get("rarity") == CardRarity.LEGENDARY.value for c in cards):
            break
        progress += 1
    return progress


def create_pack(
    db: AsyncSession,
    user_id: str,
    pack_type: PackType,
    album_id: str,
    origin: str = PackOrigin.PURCHASE.value,
    forced_rarity: Optional[str] = None,
) -> UserPack:
    """Crea un sobre sin abrir en la bandeja del usuario (no hace commit)."""
    pack = UserPack(
        user_id=user_id,
        pack_type_id=pack_type.id,
        album_id=album_id,
        origin=origin,
        opened=False,
        forced_rarity=forced_rarity,
    )
    db.add(pack)
    return pack


async def buy_pack(db: AsyncSession, user: User, pack_type: PackType) -> UserPack:
    """Compra un sobre: valida saldo, cobra y lo deja en la bandeja (commit)."""
    album = await active_album(db)
    if album is None:
        raise ValueError("No hay un album activo")

    await _require_not_completed(db, album.id, user.id)

    if user.zerines < pack_type.price_zerines:
        raise ValueError(
            f"Zerines insuficientes: tienes {user.zerines}, necesitas {pack_type.price_zerines}"
        )

    user.zerines -= pack_type.price_zerines
    db.add(
        Transaction(
            sender_id=user.id,
            amount=pack_type.price_zerines,
            type="purchase",
            description=f"Compra de {pack_type.name}",
            status="confirmed",
        )
    )
    pack = create_pack(db, user.id, pack_type, album.id, origin=PackOrigin.PURCHASE.value)
    await db.commit()
    await db.refresh(pack)
    return pack


async def open_pack(
    db: AsyncSession, user: User, pack: UserPack
) -> Tuple[List[Tuple[AlbumCard, bool, bool]], int]:
    """Abre el sobre, registra las cartas en la coleccion y devuelve el resultado.

    Reglas:
    - Rareza por pesos del PackType (o `forced_rarity` en la primera carta).
    - Piedad: si hubo >= PITY_TARGET sobres sin legendary, la primera carta de
      este sobre es legendary garantizada.
    - Foil: cada carta tiene FOIL_CHANCE (1%) de salir en variante dorada.
      Si el usuario ya tenia la carta normal, se "mejora" a foil.
    """
    if pack.opened:
        raise ValueError("Este sobre ya fue abierto")
    if pack.user_id != user.id:
        raise ValueError("Este sobre no te pertenece")

    album_id = pack.album_id
    cards_by_rarity = await _cards_by_rarity(db, album_id)
    if not cards_by_rarity:
        # El album del sobre fue eliminado (purgado): cae al album activo para
        # no dejar la bandeja con sobres inutilizables.
        fallback = await active_album(db)
        if fallback is not None and fallback.id != album_id:
            album_id = fallback.id
            pack.album_id = album_id
            cards_by_rarity = await _cards_by_rarity(db, album_id)
    if not cards_by_rarity:
        raise ValueError("El album no tiene cartas")

    weights = parse_weights(pack.pack_type)
    pity = await _pity_progress(db, user.id)
    guaranteed = pity >= PITY_TARGET

    results: List[Tuple[AlbumCard, bool, bool]] = []
    for i in range(pack.pack_type.num_cards):
        if i == 0 and pack.forced_rarity:
            rarity = pack.forced_rarity
        elif i == 0 and guaranteed:
            rarity = CardRarity.LEGENDARY.value
        else:
            rarity = pick_rarity(weights)

        pool = cards_by_rarity.get(rarity)
        if not pool:
            # Sin cartas de esa rareza: baja al siguiente nivel disponible.
            pool = next((cards_by_rarity[r] for r in RARITY_ORDER if r != rarity and cards_by_rarity.get(r)), None)
            if pool is None:
                pool = next(iter(cards_by_rarity.values()))
        card = random.choice(pool)

        foil = random.random() < FOIL_CHANCE
        existing = (
            await db.execute(
                select(UserCard).where(UserCard.user_id == user.id, UserCard.card_id == card.id)
            )
        ).scalar_one_or_none()
        if existing:
            existing.quantity += 1
            if foil:
                existing.foil = True
            is_new = False
        else:
            db.add(
                UserCard(
                    user_id=user.id,
                    album_id=pack.album_id,
                    card_id=card.id,
                    quantity=1,
                    foil=foil,
                )
            )
            is_new = True
        results.append((card, is_new, foil))

    pack.opened = True
    pack.opened_at = utcnow()
    pack.result_json = json.dumps(
        [{"card_id": card.id, "rarity": card.rarity, "foil": foil} for card, _, foil in results]
    )
    next_pity = 0 if any(card.rarity == CardRarity.LEGENDARY.value for card, _, _ in results) else pity + 1
    await db.flush()
    await _handle_completion(db, pack.album_id, user.id)
    await db.commit()
    return results, next_pity


async def exchange_duplicates(db: AsyncSession, user: User, card_ids: List[str]) -> UserPack:
    """Canje: 3 duplicados (quantity >= 2) de cualquier carta -> 1 sobre basico."""
    if len(card_ids) != 3 or len(set(card_ids)) != 3:
        raise ValueError("Selecciona exactamente 3 cartas distintas")

    album = await active_album(db)
    if album is None:
        raise ValueError("No hay un album activo")

    await _require_not_completed(db, album.id, user.id)

    rows = (
        await db.execute(
            select(UserCard).where(
                UserCard.user_id == user.id,
                UserCard.card_id.in_(card_ids),
                UserCard.album_id == album.id,
            )
        )
    ).scalars().all()
    by_card = {row.card_id: row for row in rows}
    for card_id in card_ids:
        row = by_card.get(card_id)
        if row is None or row.quantity < 2:
            raise ValueError("Una o mas cartas no son duplicados canjeables")

    for row in by_card.values():
        row.quantity -= 1

    pack_type = await cheapest_pack_type(db)
    if pack_type is None:
        raise ValueError("No hay tipos de sobre disponibles")
    pack = create_pack(db, user.id, pack_type, album.id, origin=PackOrigin.REWARD.value)
    await db.flush()
    # Si el canje completo el album, la limpieza borra este sobre recien creado
    # y resetea los duplicados: no hay premio. Cargamos pack_type antes por si
    # el objeto queda huérfano al serializar.
    await db.refresh(pack)
    await _handle_completion(db, album.id, user.id)
    await db.commit()
    return pack