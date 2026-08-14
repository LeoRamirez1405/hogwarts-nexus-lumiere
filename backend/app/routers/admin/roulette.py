"""Admin-only roulette configuration (cost + weighted segments)."""

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.roles import require_role
from ...models.roulette import RouletteConfig
from ...models.user import User
from ...schemas.roulette import RouletteConfigResponse, RouletteConfigUpdate
from ...services import roulette_service

router = APIRouter(prefix="/admin/roulette", tags=["admin-roulette"])


@router.get("", response_model=RouletteConfigResponse)
async def get_config(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
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


@router.put("", response_model=RouletteConfigResponse)
async def update_config(
    data: RouletteConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    config = await roulette_service.get_config(db)
    if config is None:
        config = RouletteConfig(
            cost_zerines=data.cost_zerines,
            segments=json.dumps([s.model_dump() for s in data.segments]),
            enabled=data.enabled,
            updated_by=current_user.id,
        )
        db.add(config)
    else:
        config.cost_zerines = data.cost_zerines
        config.segments = json.dumps([s.model_dump() for s in data.segments])
        config.enabled = data.enabled
        config.updated_by = current_user.id
    await db.commit()
    await db.refresh(config)
    return RouletteConfigResponse(
        cost_zerines=config.cost_zerines,
        segments=[s.to_dict() for s in roulette_service.parse_segments(config)],
        enabled=config.enabled,
        updated_at=config.updated_at,
    )