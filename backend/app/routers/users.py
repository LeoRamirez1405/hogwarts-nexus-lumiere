from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..database import get_db
from ..models.user import User
from ..schemas.user import (
    UserResponse,
    UserUpdate,
    AdminCreateUser,
    AdminTitleUpdate,
    HousePointsAdjust,
    MagicLevelInfo,
    HousePoints,
    AdminResetPassword,
)
from ..schemas.pagination import Page
from ..middleware.auth import get_current_user, hash_password
from ..middleware.roles import require_role
from ..utils.magic_level import get_magic_level

router = APIRouter()


def _enrich_user(user: User, level_data: dict | None = None) -> dict:
    data = {c.name: getattr(user, c.name) for c in user.__table__.columns}
    data["magic_level"] = level_data or get_magic_level(user)
    return data


@router.get("/", response_model=Page[UserResponse])
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    query = select(User).offset(skip).limit(limit + 1)
    count_query = select(func.count(User.id))
    result = await db.execute(query)
    items = result.scalars().all()
    has_more = len(items) > limit
    items = items[:limit]
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()
    return Page(
        items=[_enrich_user(u) for u in items],
        total=total,
        skip=skip,
        limit=limit,
        has_more=has_more,
    )


@router.get("/houses/{house}/points", response_model=HousePoints)
async def get_house_points(
    house: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(func.coalesce(func.sum(User.house_points), 0)).where(User.house == house)
    )
    points = result.scalar()
    return HousePoints(house=house, points=points)


@router.get("/houses/all-points")
async def get_all_house_points(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User.house, func.coalesce(func.sum(User.house_points), 0))
        .where(User.house.isnot(None))
        .group_by(User.house)
    )
    return {row[0]: row[1] for row in result.all()}


@router.post("/", response_model=UserResponse)
async def create_user(
    data: AdminCreateUser,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "El email ya esta registrado")

    user = User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        house=data.house,
        role=data.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return _enrich_user(user)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.last_active_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user)

    return _enrich_user(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    update_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this user",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(user, key, value)

    user.last_active_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user)
    return _enrich_user(user)


@router.put("/{user_id}/title", response_model=UserResponse)
async def set_user_title(
    user_id: str,
    data: AdminTitleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.official_title = data.official_title
    await db.commit()
    await db.refresh(user)
    return _enrich_user(user)


@router.post("/{user_id}/house-points", response_model=UserResponse)
async def adjust_house_points(
    user_id: str,
    data: HousePointsAdjust,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")

    user.house_points = max(0, (user.house_points or 0) + data.points)
    await db.commit()
    await db.refresh(user)
    return _enrich_user(user)


@router.post("/{user_id}/reset-password", response_model=UserResponse)
async def admin_reset_password(
    user_id: str,
    data: AdminResetPassword,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")

    user.password_hash = hash_password(data.new_password)
    await db.commit()
    await db.refresh(user)
    return _enrich_user(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    await db.delete(user)
    await db.commit()
