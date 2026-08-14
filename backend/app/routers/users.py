from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from ..database import get_db
from ..models.badge import UserBadge
from ..models.user import User
from ..schemas.badge import BadgeResponse
from ..schemas.user import UserResponse, UserUpdate, HousePoints
from ..schemas.pagination import Page
from ..middleware.auth import get_current_user
from ..utils.user_helpers import enrich_user, enrich_users
from app.utils.dates import utcnow

router = APIRouter()


@router.get("/search", response_model=Page[UserResponse])
async def search_users(
    q: str = Query(""),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Busqueda de usuarios por nombre o email (server-side).

    Retorna paginacion estandar (Page[UserResponse]). Excluye al usuario
    actual. Usado por TransferTab y otras vistas que necesitan buscar
    destinatarios sin cargar toda la tabla de usuarios.

    Con `q` vacio devuelve todos los usuarios (paginados): la vista de admin
    de grupos lo usa para la carga inicial de la lista, y antes esto disparaba
    un 422 (min_length=1) que rompia la pagina.
    """
    q = q.strip()
    # Passing multiple conditions to .where() ANDs them, so we avoid and_()
    # (which was used here but never imported — a latent NameError/500 for any
    # non-empty query).
    conditions = [User.id != current_user.id]
    if q:
        pattern = f"%{q}%"
        conditions.append(
            or_(
                User.name.ilike(pattern),
                User.email.ilike(pattern),
            )
        )
    query = select(User).where(*conditions).offset(skip).limit(limit + 1)
    result = await db.execute(query)
    items = result.scalars().all()
    has_more = len(items) > limit
    items = items[:limit]
    total_result = await db.execute(select(func.count(User.id)).where(*conditions))
    total = total_result.scalar_one()
    return Page(
        items=await enrich_users(db, items),
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


@router.get("/badges/{user_id}", response_model=list[BadgeResponse])
async def get_user_badges(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Insignias desbloqueadas por un usuario (primer completador, etc.)."""
    badges = (
        await db.execute(
            select(UserBadge)
            .where(UserBadge.user_id == user_id)
            .order_by(UserBadge.granted_at.asc())
        )
    ).scalars().all()
    return [
        BadgeResponse(
            badge_key=b.badge_key,
            label=b.label,
            icon=b.icon,
            granted_at=b.granted_at,
        )
        for b in badges
    ]


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

    return await enrich_user(db, user)


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

    if not user.profile_completed_at and all(
        (user.bio, user.avatar_url, user.wand, user.house, user.location, user.status)
    ):
        user.profile_completed_at = utcnow()

    user.last_active_at = utcnow()
    await db.commit()
    await db.refresh(user)

    return await enrich_user(db, user)
