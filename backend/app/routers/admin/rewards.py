"""Admin rewards: grant packs to users (never zerines/cards directly)."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.roles import require_role
from ...models.article_subscription import Notification
from ...models.pack import PackOrigin, PackType
from ...models.reward import AdminReward
from ...models.user import User
from ...notifications_service import N
from ...schemas.pagination import Page
from ...schemas.reward import RewardCreate, RewardResponse
from ...services import pack_service
from ...ws_manager import manager

router = APIRouter(prefix="/admin/rewards", tags=["admin-rewards"])


async def _reward_response(db: AsyncSession, reward: AdminReward) -> RewardResponse:
    admin = reward.admin or await db.get(User, reward.admin_id)
    user = reward.user or await db.get(User, reward.user_id)
    pack_type = reward.pack_type or await db.get(PackType, reward.pack_type_id)
    return RewardResponse(
        id=reward.id,
        admin_id=reward.admin_id,
        admin_name=admin.name if admin else "?",
        user_id=reward.user_id,
        user_name=user.name if user else "?",
        pack_type_id=reward.pack_type_id,
        pack_type_name=pack_type.name if pack_type else "?",
        quantity=reward.quantity,
        message=reward.message,
        created_at=reward.created_at,
    )


@router.post("", response_model=list[RewardResponse], status_code=status.HTTP_201_CREATED)
async def grant_rewards(
    data: RewardCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    if not data.user_ids:
        raise HTTPException(status_code=400, detail="Selecciona al menos un usuario")
    if data.quantity < 1 or data.quantity > 100:
        raise HTTPException(status_code=400, detail="Cantidad invalida (1-100)")
    pack_type = (
        await db.execute(select(PackType).where(PackType.id == data.pack_type_id, PackType.enabled.is_(True)))
    ).scalar_one_or_none()
    if pack_type is None:
        raise HTTPException(status_code=404, detail="Tipo de sobre no encontrado")
    album = await pack_service.active_album(db)
    if album is None:
        raise HTTPException(status_code=400, detail="No hay un album activo")

    users = (await db.execute(select(User).where(User.id.in_(data.user_ids)))).scalars().all()
    if len(users) != len(data.user_ids):
        raise HTTPException(status_code=404, detail="Uno o mas usuarios no existen")

    # Los usuarios que ya completaron el album no pueden recibir sobres nuevos.
    eligible = [
        user
        for user in users
        if not await pack_service.is_completed(db, album.id, user.id)
    ]
    if not eligible:
        raise HTTPException(
            status_code=400,
            detail="Todos los usuarios seleccionados ya completaron el album",
        )

    rewards = []
    for user in eligible:
        reward = AdminReward(
            admin_id=current_user.id,
            user_id=user.id,
            pack_type_id=pack_type.id,
            quantity=data.quantity,
            message=data.message,
        )
        db.add(reward)
        for _ in range(data.quantity):
            pack_service.create_pack(
                db, user.id, pack_type, album.id, origin=PackOrigin.REWARD.value
            )
        db.add(
            Notification(
                user_id=user.id,
                type=N.PACK_REWARD,
                title="¡Un buho te trajo un sobre!",
                body=(
                    f"{current_user.name} te envio {data.quantity} x {pack_type.name}."
                    if not data.message
                    else data.message
                ),
                related_id=reward.id,
                actor_id=current_user.id,
            )
        )
        rewards.append(reward)
    await db.commit()
    for reward in rewards:
        await manager.send_to_user(
            reward.user_id,
            {"type": N.PACK_REWARD, "title": "¡Un buho te trajo un sobre!", "body": "Tienes sobres nuevos en tu bandeja."},
        )
    return [await _reward_response(db, reward) for reward in rewards]


@router.get("", response_model=Page[RewardResponse])
async def list_rewards(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    query = select(AdminReward)
    count_query = select(func.count(AdminReward.id))
    if user_id:
        query = query.where(AdminReward.user_id == user_id)
        count_query = count_query.where(AdminReward.user_id == user_id)
    total = (await db.execute(count_query)).scalar_one()
    rows = (
        await db.execute(query.order_by(AdminReward.created_at.desc()).offset(skip).limit(limit))
    ).scalars().all()
    items = [await _reward_response(db, reward) for reward in rows]
    return Page(items=items, total=total, skip=skip, limit=limit, has_more=skip + len(items) < total)