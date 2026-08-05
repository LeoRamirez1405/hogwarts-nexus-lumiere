"""Room editing for room admins (global admins or confirmed room admins).

Room create/delete/toggle-close and member management live in
``routers.admin.rooms`` (global admin only). This endpoint is intentionally
public because confirmed room admins edit their own rooms from the chat UI.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ....database import get_db
from ....middleware.auth import get_current_user
from ....models.chat_room import ChatRoom, ChatRoomMember
from ....models.user import User
from ....schemas.message import ChatRoomResponse, ChatRoomUpdate
from ...audit_logs import log_audit
from ..serializers import serialize_room


async def require_room_admin(
    room_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    """Dependency that ensures the current user is a global admin or room admin."""
    # Global admin always has access
    if current_user.role == "admin":
        return current_user

    # Check if user is a confirmed room admin
    result = await db.execute(
        select(ChatRoomMember).where(
            ChatRoomMember.room_id == room_id,
            ChatRoomMember.user_id == current_user.id,
            ChatRoomMember.role == "admin",
            ChatRoomMember.pending.is_(False),
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="Not authorized to administer this room")
    return current_user


router = APIRouter()


@router.put("/rooms/{room_id}", response_model=ChatRoomResponse)
async def update_chat_room(
    room_id: str,
    room_data: ChatRoomUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_room_admin),
    request: Request = None,
):
    result = await db.execute(
        select(ChatRoom).where(ChatRoom.id == room_id)
    )
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    old_values = {
        "name": room.name,
        "description": room.description,
        "avatar_url": room.avatar_url,
        "closed": room.closed,
        "join_approval": bool(getattr(room, "join_approval", False)),
    }

    for key, value in room_data.model_dump(exclude_unset=True).items():
        setattr(room, key, value)

    await db.commit()
    await db.refresh(room)

    new_values = {
        "name": room.name,
        "description": room.description,
        "avatar_url": room.avatar_url,
        "closed": room.closed,
        "join_approval": bool(getattr(room, "join_approval", False)),
    }

    await log_audit(
        db,
        actor=current_user,
        action="update",
        entity_type="ChatRoom",
        entity_id=room.id,
        details={"old": old_values, "new": new_values},
        request=request,
    )

    member_result = await db.execute(
        select(ChatRoomMember)
        .where(ChatRoomMember.room_id == room.id)
        .options(selectinload(ChatRoomMember.user))
    )
    room.members = member_result.scalars().all()
    return serialize_room(room, current_user.id)
