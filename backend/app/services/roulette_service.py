"""Ruleta de la Fortuna Magica: giro ponderado, cobro y premios.

Los segmentos se guardan como JSON en RouletteConfig:
    {"prize": "pack:N" | "zerines:N" | "legendary" | "none" | "xp:N" | "spins:N",
     "label": "...", "weight": N, "pack_type_id": "..."}

- pack:N      -> N sobres (opcional pack_type_id especifico)
- zerines:N   -> N Zerines
- legendary   -> un sobre con legendaria garantizada
- none        -> no hay premio ("buen intento")
- xp:N        -> N puntos de XP (derivado: lo cuenta _batch_xp desde result_json)
- spins:N     -> N giros gratis para futuros giros
"""

import json
import random
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.pack import PackOrigin, PackType, UserPack
from ..models.roulette import RouletteConfig, RouletteSpin
from ..models.transaction import Transaction
from ..models.user import User
from . import pack_service

KNOWN_PRIZE_KINDS = ("pack", "zerines", "legendary", "none", "xp", "spins")


def _parse_int(value: str, default: int) -> int:
    try:
        return max(0, int(value))
    except (ValueError, TypeError):
        return default


class RouletteSegment:
    def __init__(self, data: dict):
        self.prize = str(data.get("prize", ""))
        self.label = str(data.get("label", self.prize))
        self.weight = int(data.get("weight", 1))
        self.pack_type_id = data.get("pack_type_id")

    def to_dict(self) -> dict:
        return {"prize": self.prize, "label": self.label, "weight": self.weight, "pack_type_id": self.pack_type_id}


def parse_segments(config: RouletteConfig) -> List[RouletteSegment]:
    if not config.segments:
        return []
    try:
        data = json.loads(config.segments)
    except (ValueError, TypeError):
        return []
    return [RouletteSegment(d) for d in data if isinstance(d, dict) and d.get("prize")]


async def get_config(db: AsyncSession) -> Optional[RouletteConfig]:
    result = await db.execute(select(RouletteConfig).order_by(RouletteConfig.updated_at.desc()).limit(1))
    return result.scalar_one_or_none()


async def _resolve_pack_type(db: AsyncSession, segment: RouletteSegment):
    if segment.pack_type_id:
        result = await db.execute(select(PackType).where(PackType.id == segment.pack_type_id))
        pack_type = result.scalar_one_or_none()
        if pack_type:
            return pack_type
    return await pack_service.cheapest_pack_type(db)


async def spin(db: AsyncSession, user: User, config: RouletteConfig):
    """Cobra el giro (zerines o giro gratis), elige el segmento ponderado y
    aplica el premio (commit).

    Devuelve (spin, packs_granted, zerines_won, xp_won, free_spins_won).
    """
    segments = parse_segments(config)
    if not segments:
        raise ValueError("La ruleta no tiene segmentos configurados")

    album = await pack_service.active_album(db)
    if album is None:
        raise ValueError("No hay un album activo")
    if await pack_service.is_completed(db, album.id, user.id):
        raise ValueError("Ya completaste este album: no puedes girar la ruleta")

    segment = random.choices(segments, weights=[s.weight for s in segments], k=1)[0]
    kind = segment.prize.split(":")[0]
    if kind not in KNOWN_PRIZE_KINDS:
        raise ValueError(f"Premio de ruleta desconocido: {segment.prize}")

    if (user.free_spins or 0) > 0:
        user.free_spins -= 1
        cost_paid = 0
    else:
        if user.zerines < config.cost_zerines:
            raise ValueError(
                f"Zerines insuficientes: tienes {user.zerines}, necesitas {config.cost_zerines}"
            )
        user.zerines -= config.cost_zerines
        cost_paid = config.cost_zerines
        db.add(
            Transaction(
                sender_id=user.id,
                amount=config.cost_zerines,
                type="purchase",
                description="Giro de la Ruleta de la Fortuna",
                status="confirmed",
            )
        )

    packs_granted = []
    zerines_won = 0
    xp_won = 0
    free_spins_won = 0
    if kind == "pack":
        count = max(1, _parse_int(segment.prize.split(":")[1], 1))
        pack_type = await _resolve_pack_type(db, segment)
        for _ in range(count):
            packs_granted.append(
                pack_service.create_pack(
                    db, user.id, pack_type, album.id, origin=PackOrigin.ROULETTE.value
                )
            )
    elif kind == "zerines":
        zerines_won = _parse_int(segment.prize.split(":")[1], 0)
        user.zerines += zerines_won
        db.add(
            Transaction(
                receiver_id=user.id,
                amount=zerines_won,
                type="deposit",
                description=f"Premio de ruleta: {segment.label}",
                status="confirmed",
            )
        )
    elif kind == "legendary":
        pack_type = await _resolve_pack_type(db, segment)
        packs_granted.append(
            pack_service.create_pack(
                db, user.id, pack_type, album.id, origin=PackOrigin.ROULETTE.value,
                forced_rarity="legendary",
            )
        )
    elif kind == "xp":
        xp_won = _parse_int(segment.prize.split(":")[1], 0)
    elif kind == "spins":
        free_spins_won = _parse_int(segment.prize.split(":")[1], 0)
        user.free_spins = (user.free_spins or 0) + free_spins_won
    elif kind == "none":
        pass

    spin_row = RouletteSpin(
        user_id=user.id,
        cost=cost_paid,
        result_json=json.dumps({"prize": segment.prize, "label": segment.label}),
    )
    db.add(spin_row)
    await db.flush()
    if packs_granted:
        ids = [p.id for p in packs_granted]
        packs_granted = list(
            (
                await db.execute(
                    select(UserPack)
                    .where(UserPack.id.in_(ids))
                    .options(selectinload(UserPack.pack_type), selectinload(UserPack.album))
                )
            ).scalars().all()
        )
    await db.commit()
    await db.refresh(spin_row)
    return spin_row, packs_granted, zerines_won, xp_won, free_spins_won