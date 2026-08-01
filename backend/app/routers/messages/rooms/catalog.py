"""Admin CRUD endpoints for chat rooms: create, update, delete, toggle-close.

All routes require the ``admin`` role.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ....database import get_db
from ....middleware.roles import require_role
from ....models.chat_room import ChatRoom, ChatRoomMember
from ....models.user import User
from ....schemas.message import ChatRoomCreate, ChatRoomResponse, ChatRoomUpdate
from ...audit_logs import log_audit
from ..serializers import serialize_room

router = APIRouter()


@router.post(
    "/rooms", response_model=ChatRoomResponse, status_code=status.HTTP_201_CREATED
)
async def create_chat_room(
    room_data: ChatRoomCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
    request: Request = None,
):
    room = ChatRoom(
        name=room_data.name,
        description=room_data.description,
        avatar_url=room_data.avatar_url,
        type=room_data.type,
        created_by=current_user.id,
    )
    db.add(room)
    await db.flush()

    owner_member = ChatRoomMember(
        room_id=room.id,
        user_id=current_user.id,
        role="admin",
    )
    db.add(owner_member)

    for member_id in room_data.member_ids:
        if member_id == current_user.id:
            continue
        user_result = await db.execute(select(User).where(User.id == member_id))
        user = user_result.scalar_one_or_none()
        if user:
            member = ChatRoomMember(room_id=room.id, user_id=member_id, role="member")
            db.add(member)

    await db.commit()
    await db.refresh(room)

    await log_audit(
        db,
        actor=current_user,
        action="create",
        entity_type="ChatRoom",
        entity_id=room.id,
        details={"name": room.name, "type": room.type, "initial_member_count": len(room_data.member_ids) + 1},
        request=request,
    )

    member_result = await db.execute(
        select(ChatRoomMember)
        .where(ChatRoomMember.room_id == room.id)
        .options(selectinload(ChatRoomMember.user))
    )
    room.members = member_result.scalars().all()

    return serialize_room(room, current_user.id)


@router.put("/rooms/{room_id}", response_model=ChatRoomResponse)
async def update_chat_room(
    room_id: str,
    room_data: ChatRoomUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
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


@router.delete("/rooms/{room_id}", status_code=204)
async def delete_chat_room(
    room_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
    request: Request = None,
):
    result = await db.execute(select(ChatRoom).where(ChatRoom.id == room_id))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    room_name = room.name

    await db.delete(room)
    await db.commit()

    await log_audit(
        db,
        actor=current_user,
        action="delete",
        entity_type="ChatRoom",
        entity_id=room_id,
        details={"room_name": room_name},
        request=request,
    )


@router.put("/rooms/{room_id}/toggle-close", response_model=ChatRoomResponse)
async def toggle_room_closed(
    room_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
    request: Request = None,
):
    result = await db.execute(select(ChatRoom).where(ChatRoom.id == room_id))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    old_closed = room.closed
    room.closed = not room.closed
    await db.commit()
    await db.refresh(room)

    await log_audit(
        db,
        actor=current_user,
        action="update",
        entity_type="ChatRoom",
        entity_id=room.id,
        details={"field": "closed", "old": old_closed, "new": room.closed},
        request=request,
    )

    member_result = await db.execute(
        select(ChatRoomMember)
        .where(ChatRoomMember.room_id == room.id)
        .options(selectinload(ChatRoomMember.user))
    )
    room.members = member_result.scalars().all()
    return serialize_room(room, current_user.id)
