from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....middleware.auth import get_current_user
from ....models.user import User
from ....services.messages.message_service import delete_message_service
from ....ws_manager import manager

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

    event = {
        "t": "delete",
        "c": room_id or receiver_id,
        "m": message_id,
        "ts": int(datetime.utcnow().timestamp() * 1000),
    }
    if room_id:
        await manager.broadcast_to_room(room_id, event)
    elif receiver_id:
        await manager.send_to_user(receiver_id, event)
        await manager.send_to_user(current_user.id, event)