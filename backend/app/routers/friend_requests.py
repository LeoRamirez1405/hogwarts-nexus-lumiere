from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from ..database import get_db
from ..models.friend_request import FriendRequest
from ..models.user import User
from ..schemas.friend_request import FriendRequestCreate, FriendRequestResponse
from ..schemas.user import UserResponse
from ..schemas.pagination import Page
from ..middleware.auth import get_current_user
from ..notifications_service import notify, N
from sqlalchemy.orm import selectinload

router = APIRouter()


async def _collect_friends(db: AsyncSession, user_id: str) -> List[User]:
    """Return all Users considered friends of `user_id` (accepted requests,
    both directions)."""
    result = await db.execute(
        select(FriendRequest).where(
            or_(
                FriendRequest.sender_id == user_id,
                FriendRequest.receiver_id == user_id,
            ),
            FriendRequest.status == "accepted",
        ).options(selectinload(FriendRequest.sender), selectinload(FriendRequest.receiver))
    )
    rows = result.scalars().all()
    friends: List[User] = []
    seen: set[str] = set()
    for fr in rows:
        if fr.sender_id == user_id and fr.receiver:
            friend = fr.receiver
        elif fr.receiver_id == user_id and fr.sender:
            friend = fr.sender
        else:
            continue
        if friend.id not in seen:
            seen.add(friend.id)
            friends.append(friend)
    return friends


@router.get("/", response_model=List[FriendRequestResponse])
async def list_friend_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(FriendRequest).where(
            or_(
                FriendRequest.sender_id == current_user.id,
                FriendRequest.receiver_id == current_user.id,
            )
        ).order_by(FriendRequest.created_at.desc())
    )
    return result.scalars().all()


@router.get("/friends/{user_id}", response_model=List[UserResponse])
async def list_friends(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Devuelve los usuarios amigos de user_id (solicitudes aceptadas en ambos sentidos)."""
    return await _collect_friends(db, user_id)


@router.get("/friends/{user_id}/paginated", response_model=Page[UserResponse])
async def list_friends_paginated(
    user_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Same set as `GET /friend-requests/friends/{user_id}` but paginated —
    useful for accounts with many friends (e.g. through AllFriendsModal)."""
    friends = await _collect_friends(db, user_id)
    total = len(friends)
    page = friends[skip : skip + limit]
    has_more = skip + limit < total
    return Page(
        items=[UserResponse.model_validate(u) for u in page],
        total=total,
        skip=skip,
        limit=limit,
        has_more=has_more,
    )


@router.delete(
    "/unfriend/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def unfriend(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete the accepted friendship between `current_user` and `user_id`.
    Removes the underlying friend request record (idempotent: returns 204 even
    if no accepted record existed). The other user is not notified."""
    result = await db.execute(
        select(FriendRequest).where(
            or_(
                (FriendRequest.sender_id == current_user.id) & (FriendRequest.receiver_id == user_id),
                (FriendRequest.sender_id == user_id) & (FriendRequest.receiver_id == current_user.id),
            ),
            FriendRequest.status == "accepted",
        )
    )
    fr = result.scalar_one_or_none()
    if fr:
        await db.delete(fr)
        await db.commit()
    return None


@router.post("/", response_model=FriendRequestResponse, status_code=status.HTTP_201_CREATED)
async def send_friend_request(
    data: FriendRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.receiver_id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes enviarte una solicitud a ti mismo")

    receiver = await db.execute(select(User).where(User.id == data.receiver_id))
    if not receiver.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    existing = await db.execute(
        select(FriendRequest).where(
            or_(
                (FriendRequest.sender_id == current_user.id) & (FriendRequest.receiver_id == data.receiver_id),
                (FriendRequest.sender_id == data.receiver_id) & (FriendRequest.receiver_id == current_user.id),
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe una solicitud entre estos usuarios")

    fr = FriendRequest(sender_id=current_user.id, receiver_id=data.receiver_id)
    db.add(fr)
    await notify(
        db,
        user_id=data.receiver_id,
        type=N.FRIEND_REQUEST,
        title=f"{current_user.name} te envió una solicitud de amistad",
        body="Revisa tu perfil para aceptarla o rechazarla.",
        related_id=current_user.id,
        actor_id=current_user.id,
    )
    await db.commit()
    await db.refresh(fr)
    return fr


@router.put("/{request_id}/accept", response_model=FriendRequestResponse)
async def accept_friend_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(FriendRequest).where(FriendRequest.id == request_id))
    fr = result.scalar_one_or_none()
    if not fr:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if fr.receiver_id != current_user.id:
        raise HTTPException(status_code=403, detail="No autorizado")
    if fr.status != "pending":
        raise HTTPException(status_code=400, detail="La solicitud ya fue procesada")

    fr.status = "accepted"
    await notify(
        db,
        user_id=fr.sender_id,
        type=N.FRIEND_ACCEPTED,
        title=f"{current_user.name} aceptó tu solicitud de amistad",
        body="¡Ahora son amigos!",
        related_id=current_user.id,
        actor_id=current_user.id,
    )
    await db.commit()
    await db.refresh(fr)
    return fr


@router.put("/{request_id}/reject", response_model=FriendRequestResponse)
async def reject_friend_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(FriendRequest).where(FriendRequest.id == request_id))
    fr = result.scalar_one_or_none()
    if not fr:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if fr.receiver_id != current_user.id:
        raise HTTPException(status_code=403, detail="No autorizado")
    if fr.status != "pending":
        raise HTTPException(status_code=400, detail="La solicitud ya fue procesada")

    fr.status = "rejected"
    await db.commit()
    await db.refresh(fr)
    return fr


@router.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_friend_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(FriendRequest).where(FriendRequest.id == request_id))
    fr = result.scalar_one_or_none()
    if not fr:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if fr.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="No autorizado")

    await db.delete(fr)
    await db.commit()
