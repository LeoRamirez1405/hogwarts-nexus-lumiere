from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..database import get_db
from ..models.user import User
from ..schemas.user import (
    UserResponse,
    UserUpdate,
    AdminTitleUpdate,
    MagicLevelInfo,
    HousePoints,
)
from ..middleware.auth import get_current_user
from ..middleware.roles import require_role
from ..utils.magic_level import get_magic_level

router = APIRouter()


def _enrich_user(user: User, level_data: dict | None = None) -> dict:
    data = {c.name: getattr(user, c.name) for c in user.__table__.columns}
    data["magic_level"] = level_data or get_magic_level(user)
    return data


@router.get("/", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(User))
    users = result.scalars().all()
    return [_enrich_user(u) for u in users]


@router.get("/houses/{house}/points", response_model=HousePoints)
async def get_house_points(
    house: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(func.coalesce(func.sum(User.zerines), 0)).where(User.house == house)
    )
    points = result.scalar()
    return HousePoints(house=house, points=points)


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
