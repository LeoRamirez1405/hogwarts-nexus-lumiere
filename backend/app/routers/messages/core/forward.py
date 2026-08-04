from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....middleware.auth import get_current_user
from ....models.user import User
from ....schemas.message import ForwardMessageRequest, MessageResponse
from ....services.messages.message_service import forward_message_service
from ....ws_manager import manager
from ..serializers import serialize_message

router = APIRouter()


@router.post("/{message_id}/forward", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def forward_message(
    message_id: str,
    forward_data: ForwardMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        new_msg = await forward_message_service(db, message_id, forward_data, current_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    serialized = await serialize_message(
        db, new_msg, current_user.id, expand_sender=True, expand_reply_to=True
    )

    conversation_id = new_msg.room_id or new_msg.receiver_id or ""
    payload = {
        "t": "new_message",
        "c": conversation_id,
        "m": serialized.model_dump(mode="json"),
        "ts": int(new_msg.created_at.timestamp() * 1000),
    }
    if new_msg.room_id:
        await manager.broadcast_to_room(new_msg.room_id, payload, exclude_user=current_user.id)
    elif new_msg.receiver_id:
        await manager.send_to_user(new_msg.receiver_id, payload)

    return serialized