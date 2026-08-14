
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....middleware.auth import get_current_user
from ....models.user import User
from ....schemas.message import MessageResponse
from ....services.messages.message_service import edit_message_service
from ....ws_manager import manager
from ..serializers import serialize_message
from app.utils.dates import utcnow

router = APIRouter()


class MessageEditRequest(BaseModel):
    body: str


@router.patch("/{message_id}", response_model=MessageResponse)
async def edit_message(
    message_id: str,
    edit_data: MessageEditRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        message = await edit_message_service(db, message_id, edit_data.body, current_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    serialized = await serialize_message(db, message, current_user.id, expand_sender=True)
    event = {
        "t": "edit",
        "c": message.room_id or message.receiver_id,
        "m": serialized.model_dump(mode="json"),
        "ts": int(utcnow().timestamp() * 1000),
    }
    if message.room_id:
        await manager.broadcast_to_room(message.room_id, event, exclude_user=current_user.id)
    elif message.receiver_id:
        await manager.send_to_user(message.receiver_id, event)
        await manager.send_to_user(current_user.id, event)

    return serialized