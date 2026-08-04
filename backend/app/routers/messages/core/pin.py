from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....middleware.auth import get_current_user
from ....models.user import User
from ....schemas.message import MessageResponse
from ....services.messages.message_service import (
    list_dm_pinned_service,
    list_room_pinned_service,
    toggle_pin_service,
)
from ..serializers import serialize_message

router = APIRouter()


@router.put("/{message_id}/pin", response_model=MessageResponse)
async def toggle_pin(
    message_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        msg = await toggle_pin_service(db, message_id, current_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return await serialize_message(db, msg, current_user.id)


@router.get("/rooms/{room_id}/pinned", response_model=List[MessageResponse])
async def list_room_pinned(
    room_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        rows = await list_room_pinned_service(db, room_id, current_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    return [await serialize_message(db, m, current_user.id) for m in rows]


@router.get("/dm/{user_id}/pinned", response_model=List[MessageResponse])
async def list_dm_pinned(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = await list_dm_pinned_service(db, user_id, current_user)
    return [await serialize_message(db, m, current_user.id) for m in rows]