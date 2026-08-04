from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....middleware.auth import get_current_user
from ....models.user import User
from ....schemas.message import MessageResponse
from ....services.messages.message_service import list_starred_service, toggle_star_service
from ..serializers import serialize_message

router = APIRouter()


@router.get("/starred", response_model=List[MessageResponse])
async def list_starred_messages(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=200),
):
    rows = await list_starred_service(db, current_user, limit)
    return [await serialize_message(db, m, current_user.id) for m in rows]


@router.put("/{message_id}/star")
async def toggle_star(
    message_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        result = await toggle_star_service(db, message_id, current_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return result