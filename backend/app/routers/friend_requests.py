from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from ..database import get_db
from ..models.friend_request import FriendRequest
from ..models.user import User
from ..schemas.friend_request import FriendRequestCreate, FriendRequestResponse
from ..middleware.auth import get_current_user

router = APIRouter()


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
