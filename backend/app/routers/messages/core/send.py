from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....middleware.auth import get_current_user
from ....models.user import User
from ....schemas.message import MessageCreate, MessageResponse
from ....services.messages.message_service import (
    reload_message_for_response,
    send_notifications_after_send,
    validate_and_create_message,
)
from ....services.messages.conversation_prefs import _update_conversation_preferences
from ..serializers import serialize_message

router = APIRouter()


@router.post("/", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    message_data: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        message, receiver = await validate_and_create_message(db, message_data, current_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    await send_notifications_after_send(db, message, current_user, receiver)

    await _update_conversation_preferences(db, message, current_user)

    message = await reload_message_for_response(db, message)

    return await serialize_message(
        db,
        message,
        current_user.id,
        expand_sender=True,
        expand_reply_to=True,
    )