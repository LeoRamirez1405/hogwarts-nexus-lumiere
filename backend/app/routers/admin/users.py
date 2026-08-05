"""Admin-only user management routes (prefix /admin/users)."""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.auth import hash_password
from ...middleware.roles import require_role
from ...models.user import User
from ...schemas.pagination import Page
from ...schemas.user import (
    AdminCreateUser,
    AdminResetPassword,
    AdminTitleUpdate,
    AdminUpdateUser,
    HousePointsAdjust,
    UserResponse,
)
from ...utils.user_helpers import delete_user_relations, enrich_user, enrich_users
from ..audit_logs import log_audit

router = APIRouter(prefix="/admin/users", tags=["admin-users"])


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
        items=await enrich_users(db, items),
        total=total,
        skip=skip,
        limit=limit,
        has_more=has_more,
    )


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: AdminCreateUser,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
    request: Request = None,
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
    await log_audit(
        db,
        actor=current_user,
        action="create",
        entity_type="User",
        entity_id=user.id,
        details={"name": user.name, "email": user.email, "role": user.role, "house": user.house},
        request=request,
    )
    return await enrich_user(db, user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    update_data: AdminUpdateUser,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
    request: Request = None,
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    old_values = {c.name: getattr(user, c.name) for c in user.__table__.columns}
    update_dict = update_data.model_dump(exclude_unset=True)
    if "password" in update_dict:
        user.password_hash = hash_password(update_dict.pop("password"))
    for key, value in update_dict.items():
        setattr(user, key, value)
    await db.commit()
    await db.refresh(user)

    await log_audit(
        db,
        actor=current_user,
        action="update",
        entity_type="User",
        entity_id=user.id,
        details={"old": old_values, "new": update_dict},
        request=request,
    )
    return await enrich_user(db, user)


@router.put("/{user_id}/title", response_model=UserResponse)
async def set_user_title(
    user_id: str,
    data: AdminTitleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
    request: Request = None,
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    old_title = user.official_title
    user.official_title = data.official_title
    await db.commit()
    await db.refresh(user)

    await log_audit(
        db,
        actor=current_user,
        action="update",
        entity_type="User",
        entity_id=user.id,
        details={"field": "official_title", "old": old_title, "new": data.official_title},
        request=request,
    )
    return await enrich_user(db, user)


@router.post("/{user_id}/house-points", response_model=UserResponse)
async def adjust_house_points(
    user_id: str,
    data: HousePointsAdjust,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
    request: Request = None,
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")

    old_points = user.house_points or 0
    user.house_points = max(0, old_points + data.points)
    await db.commit()
    await db.refresh(user)

    await log_audit(
        db,
        actor=current_user,
        action="house_points_adjust",
        entity_type="User",
        entity_id=user.id,
        details={"points_change": data.points, "old_total": old_points, "new_total": user.house_points, "reason": data.reason},
        request=request,
    )
    return await enrich_user(db, user)


@router.post("/{user_id}/reset-password", response_model=UserResponse)
async def admin_reset_password(
    user_id: str,
    data: AdminResetPassword,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
    request: Request = None,
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")

    user.password_hash = hash_password(data.new_password)
    await db.commit()
    await db.refresh(user)

    await log_audit(
        db,
        actor=current_user,
        action="password_reset",
        entity_type="User",
        entity_id=user.id,
        details={"target_user": user.name},
        request=request,
    )
    return await enrich_user(db, user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
    request: Request = None,
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    deleted_user_name = user.name

    await delete_user_relations(db, user_id)
    await db.delete(user)
    await db.commit()

    await log_audit(
        db,
        actor=current_user,
        action="delete",
        entity_type="User",
        entity_id=user_id,
        details={"deleted_user_name": deleted_user_name},
        request=request,
    )
