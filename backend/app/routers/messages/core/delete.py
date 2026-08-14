
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ....database import get_db
from ....middleware.auth import get_current_user
from ....models.message import Message
from ....models.user import User
from ....services.messages.message_service import delete_message_service
from ....ws_manager import manager
from ..serializers.message import _preview_message
from app.utils.dates import utcnow

router = APIRouter()


@router.delete("/{message_id}", status_code=204)
async def delete_message(
    message_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        room_id, receiver_id = await delete_message_service(db, message_id, current_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # The service already re-pointed last_message_*; fetch the surviving latest
    # message so the broadcast can carry the new conversation preview.
    new_last_preview = None
    if room_id:
        latest = (
            await db.execute(
                select(Message)
                .options(selectinload(Message.sender))
                .where(Message.room_id == room_id)
                .order_by(Message.created_at.desc(), Message.id.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if latest:
            new_last_preview = _preview_message(latest, latest.sender)
    elif receiver_id:
        latest = (
            await db.execute(
                select(Message)
                .options(selectinload(Message.sender))
                .where(
                    Message.room_id.is_(None),
                    or_(
                        and_(Message.sender_id == current_user.id, Message.receiver_id == receiver_id),
                        and_(Message.sender_id == receiver_id, Message.receiver_id == current_user.id),
                    ),
                )
                .order_by(Message.created_at.desc(), Message.id.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if latest:
            new_last_preview = _preview_message(latest, latest.sender)

    event = {
        "t": "delete",
        "c": room_id or receiver_id,
        "m": message_id,
        "lm": new_last_preview.model_dump(mode="json") if new_last_preview else None,
        "ts": int(utcnow().timestamp() * 1000),
    }
    if room_id:
        await manager.broadcast_to_room(room_id, event)
    elif receiver_id:
        await manager.send_to_user(receiver_id, event)
        await manager.send_to_user(current_user.id, event)
