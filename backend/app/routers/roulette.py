"""Roulette routes: config read, spin, and history."""

import json
import logging
import traceback

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..middleware.auth import get_current_user
from ..models.roulette import RouletteSpin
from ..models.user import User
from ..schemas.roulette import (
    RouletteConfigResponse,
    RouletteSpinResponse,
    SpinResponse,
)
from ..services import pack_service, roulette_service

logger = logging.getLogger("roulette")

router = APIRouter()


@router.get("", response_model=RouletteConfigResponse)
async def get_roulette_config(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    config = await roulette_service.get_config(db)
    if config is None:
        raise HTTPException(status_code=404, detail="Ruleta no configurada")
    return RouletteConfigResponse(
        cost_zerines=config.cost_zerines,
        segments=[s.to_dict() for s in roulette_service.parse_segments(config)],
        enabled=config.enabled,
        updated_at=config.updated_at,
    )


@router.post("/spin", response_model=SpinResponse, status_code=status.HTTP_201_CREATED)
async def spin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = await roulette_service.get_config(db)
    if config is None or not config.enabled:
        raise HTTPException(status_code=400, detail="La ruleta no esta disponible")
    try:
        spin_row, packs_granted, zerines_won, xp_won, free_spins_won = await roulette_service.spin(
            db, current_user, config
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    result = json.loads(spin_row.result_json or "{}")
    try:
        return SpinResponse(
            spin_id=spin_row.id,
            cost=spin_row.cost,
            prize=result.get("prize", ""),
            label=result.get("label", ""),
            packs_granted=[pack_service.user_pack_response(p) for p in packs_granted],
            zerines_won=zerines_won,
            xp_won=xp_won,
            free_spins_won=free_spins_won,
            created_at=spin_row.created_at,
        )
    except Exception:
        logger.error("spin serialization failed:\n%s", traceback.format_exc())
        raise


@router.get("/history", response_model=list[RouletteSpinResponse])
async def roulette_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    spins = (
        await db.execute(
            select(RouletteSpin)
            .where(RouletteSpin.user_id == current_user.id)
            .order_by(RouletteSpin.created_at.desc())
            .limit(50)
        )
    ).scalars().all()
    return [
        RouletteSpinResponse(
            id=s.id,
            user_id=s.user_id,
            cost=s.cost,
            result=json.loads(s.result_json) if s.result_json else None,
            created_at=s.created_at,
        )
        for s in spins
    ]