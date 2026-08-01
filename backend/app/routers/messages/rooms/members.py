"""Room membership management endpoints (admin-only): add, batch-add, remove."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ....database import get_db
from ....middleware.roles import require_role
from ....models.chat_room import ChatRoom, ChatRoomMember
from ....models.user import User
from ....notifications_service import N, notify
from ....schemas.message import ChatRoomMemberResponse
from ...audit_logs import log_audit

router = APIRouter()


@router.post(
    "/rooms/{room_id}/members",
    response_model=ChatRoomMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_room_member(
    room_id: str,
    member_id: str = Query(..., alias="user_id"),
    role: str = "member",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
    request: Request = None,
):
    room_result = await db.execute(select(ChatRoom).where(ChatRoom.id == room_id))
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    existing = await db.execute(
        select(ChatRoomMember).where(
            and_(
                ChatRoomMember.room_id == room_id,
                ChatRoomMember.user_id == member_id,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User already in room")

    user_result = await db.execute(select(User).where(User.id == member_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    member = ChatRoomMember(room_id=room_id, user_id=member_id, role=role)
    db.add(member)
    await notify(
        db,
        user_id=member_id,
        type=N.GROUP_ADDED,
        title=f"Te agregaron a {room.name}",
        body=f"{current_user.name} te añadió al grupo {room.name}.",
        related_id=room_id,
        actor_id=current_user.id,
    )
    await db.commit()
    await db.refresh(member)

    await log_audit(
        db,
        actor=current_user,
        action="create",
        entity_type="ChatRoomMember",
        entity_id=member.id,
        details={"room_id": room_id, "room_name": room.name, "added_user_id": member_id, "added_user_name": user.name, "role": role},
        request=request,
    )

    member.user = user
    return ChatRoomMemberResponse.model_validate(member)


@router.post(
    "/rooms/{room_id}/members/batch",
    response_model=List[ChatRoomMemberResponse],
    status_code=status.HTTP_201_CREATED,
)
async def add_room_members_batch(
    room_id: str,
    member_ids: List[str] = Query(..., alias="user_id"),
    role: str = "member",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
    request: Request = None,
):
    room_result = await db.execute(select(ChatRoom).where(ChatRoom.id == room_id))
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    # Validate all users exist and are not already members
    if not member_ids:
        raise HTTPException(status_code=400, detail="At least one user_id is required")

    existing_result = await db.execute(
        select(ChatRoomMember.user_id).where(
            and_(
                ChatRoomMember.room_id == room_id,
                ChatRoomMember.user_id.in_(member_ids),
            )
        )
    )
    existing_ids = {row[0] for row in existing_result.all()}
    if existing_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Users already in room: {', '.join(existing_ids)}",
        )

    # Fetch all users in one query
    users_result = await db.execute(select(User).where(User.id.in_(member_ids)))
    users = {u.id: u for u in users_result.scalars().all()}
    missing = [mid for mid in member_ids if mid not in users]
    if missing:
        raise HTTPException(
            status_code=404, detail=f"Users not found: {', '.join(missing)}"
        )

    # Bulk insert all members
    members = [
        ChatRoomMember(room_id=room_id, user_id=mid, role=role) for mid in member_ids
    ]
    db.add_all(members)

    # Notify all added members
    for mid in member_ids:
        await notify(
            db,
            user_id=mid,
            type=N.GROUP_ADDED,
            title=f"Te agregaron a {room.name}",
            body=f"{current_user.name} te añadió al grupo {room.name}.",
            related_id=room_id,
            actor_id=current_user.id,
        )

    await db.commit()

    # Refresh all members with user data
    result = await db.execute(
        select(ChatRoomMember)
        .where(ChatRoomMember.room_id == room_id)
        .where(ChatRoomMember.user_id.in_(member_ids))
        .options(selectinload(ChatRoomMember.user))
    )
    added = result.scalars().all()

    await log_audit(
        db,
        actor=current_user,
        action="batch_add_members",
        entity_type="ChatRoom",
        entity_id=room_id,
        details={"room_name": room.name, "added_count": len(added), "added_user_ids": member_ids},
        request=request,
    )

    return [ChatRoomMemberResponse.model_validate(m) for m in added]


@router.delete("/rooms/{room_id}/members/{member_id}", status_code=204)
async def remove_room_member(
    room_id: str,
    member_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
    request: Request = None,
):
    result = await db.execute(
        select(ChatRoomMember).where(
            and_(
                ChatRoomMember.room_id == room_id,
                ChatRoomMember.user_id == member_id,
            )
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    user_result = await db.execute(select(User).where(User.id == member_id))
    user = user_result.scalar_one_or_none()

    await db.delete(member)
    await db.commit()

    await log_audit(
        db,
        actor=current_user,
        action="delete",
        entity_type="ChatRoomMember",
        entity_id=member.id,
        details={"room_id": room_id, "removed_user_id": member_id, "removed_user_name": user.name if user else "unknown"},
        request=request,
    )
