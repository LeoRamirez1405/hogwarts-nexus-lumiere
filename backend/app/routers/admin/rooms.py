"""Admin-only chat room routes (prefix /admin/rooms).

Room create/delete/toggle-close plus member management. The room edit
endpoint (``PUT /messages/rooms/{room_id}``) intentionally stays in the
public catalog because room admins use it from the chat UI.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...database import get_db
from ...middleware.roles import require_role
from ...models.chat_room import ChatRoom, ChatRoomMember
from ...models.user import User
from ...notifications_service import N, notify
from ...schemas.message import (
    ChatRoomCreate,
    ChatRoomMemberResponse,
    ChatRoomResponse,
    PendingMemberAction,
    RoleUpdateRequest,
)
from ..audit_logs import log_audit
from ..messages.serializers import serialize_room
from app.utils.dates import utcnow

router = APIRouter(prefix="/admin/rooms", tags=["admin-rooms"])


def _room_admin_or_global_admin(
    current_user: User, room: ChatRoom
) -> bool:
    """True if the current user can administer the room.

    Global ``admin`` role always wins; otherwise the user must be a confirmed
    room admin member.
    """
    if current_user.role == "admin":
        return True
    return any(
        m.user_id == current_user.id and m.role == "admin" and not m.pending
        for m in room.members
    )


@router.post(
    "/", response_model=ChatRoomResponse, status_code=status.HTTP_201_CREATED
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


@router.delete("/{room_id}", status_code=204)
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


@router.put("/{room_id}/toggle-close", response_model=ChatRoomResponse)
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


@router.post(
    "/{room_id}/members",
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
    "/{room_id}/members/batch",
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


@router.delete("/{room_id}/members/{member_id}", status_code=204)
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


@router.put(
    "/{room_id}/members/{member_id}/role",
    response_model=ChatRoomMemberResponse,
)
async def change_member_role(
    room_id: str,
    member_id: str,
    data: RoleUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
    request: Request = None,
):
    """Change a member's role (admin <-> member). Site admins only."""
    room_result = await db.execute(
        select(ChatRoom)
        .where(ChatRoom.id == room_id)
        .options(selectinload(ChatRoom.members))
    )
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if not _room_admin_or_global_admin(current_user, room):
        raise HTTPException(status_code=403, detail="Only room admins can change roles")
    if data.role not in ("admin", "member"):
        raise HTTPException(status_code=400, detail="role must be 'admin' or 'member'")

    member_result = await db.execute(
        select(ChatRoomMember)
        .where(
            and_(
                ChatRoomMember.room_id == room_id,
                ChatRoomMember.user_id == member_id,
            )
        )
        .options(selectinload(ChatRoomMember.user))
    )
    member = member_result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if member.pending:
        raise HTTPException(status_code=400, detail="Cannot change role of pending member")

    old_role = member.role
    member.role = data.role
    await db.commit()
    await db.refresh(member)

    await log_audit(
        db,
        actor=current_user,
        action="change_role",
        entity_type="ChatRoomMember",
        entity_id=member.id,
        details={"room_id": room_id, "room_name": room.name, "user_id": member_id, "old_role": old_role, "new_role": data.role},
        request=request,
    )

    return ChatRoomMemberResponse.model_validate(member)


@router.post(
    "/{room_id}/members/approve",
    response_model=ChatRoomMemberResponse,
)
async def approve_or_reject_pending_member(
    room_id: str,
    data: PendingMemberAction,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
    request: Request = None,
):
    """Approve or reject a pending join request. Site admins only."""
    room_result = await db.execute(
        select(ChatRoom)
        .where(ChatRoom.id == room_id)
        .options(selectinload(ChatRoom.members))
    )
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if not _room_admin_or_global_admin(current_user, room):
        raise HTTPException(status_code=403, detail="Only room admins can approve members")

    if data.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")

    member_result = await db.execute(
        select(ChatRoomMember)
        .where(
            and_(
                ChatRoomMember.room_id == room_id,
                ChatRoomMember.user_id == data.user_id,
                ChatRoomMember.pending,
            )
        )
        .options(selectinload(ChatRoomMember.user))
    )
    member = member_result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Pending member not found")

    user = member.user
    if data.action == "approve":
        member.pending = False
        member.joined_at = utcnow()
        await db.commit()
        await db.refresh(member)

        await notify(
            db,
            user_id=member.user_id,
            type=N.GROUP_ADDED,
            title="Solicitud aprobada",
            body=f"Tu solicitud para unirte a {room.name} fue aprobada.",
            related_id=room_id,
            actor_id=current_user.id,
        )

        # Notify all room admins
        admin_ids = [
            m.user_id for m in room.members
            if m.role == "admin" and not m.pending and m.user_id != current_user.id
        ]
        for admin_id in admin_ids:
            await notify(
                db,
                user_id=admin_id,
                type=N.GROUP_ADDED,
                title="Nuevo miembro",
                body=f"{user.name if user else 'Un usuario'} se unio a {room.name}.",
                related_id=room_id,
                actor_id=current_user.id,
            )

        await log_audit(
            db,
            actor=current_user,
            action="approve_member",
            entity_type="ChatRoomMember",
            entity_id=member.id,
            details={"room_id": room_id, "room_name": room.name, "user_id": member.user_id},
            request=request,
        )

        return ChatRoomMemberResponse.model_validate(member)
    else:
        # Reject: delete the pending membership
        await db.delete(member)
        await db.commit()

        await notify(
            db,
            user_id=member.user_id,
            type=N.GROUP_ADDED,  # reuse type; client can check body
            title="Solicitud rechazada",
            body=f"Tu solicitud para unirte a {room.name} fue rechazada.",
            related_id=room_id,
            actor_id=current_user.id,
        )

        await log_audit(
            db,
            actor=current_user,
            action="reject_member",
            entity_type="ChatRoomMember",
            entity_id=member.id,
            details={"room_id": room_id, "room_name": room.name, "user_id": member.user_id},
            request=request,
        )

        return {"ok": True, "rejected": True}


@router.get("/{room_id}/members/pending", response_model=List[ChatRoomMemberResponse])
async def list_pending_members(
    room_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """List all pending join requests for a room. Site admins only."""
    room_result = await db.execute(
        select(ChatRoom)
        .where(ChatRoom.id == room_id)
        .options(selectinload(ChatRoom.members).selectinload(ChatRoomMember.user))
    )
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if not _room_admin_or_global_admin(current_user, room):
        raise HTTPException(status_code=403, detail="Only room admins can view pending members")

    result = await db.execute(
        select(ChatRoomMember)
        .where(
            and_(
                ChatRoomMember.room_id == room_id,
                ChatRoomMember.pending,
            )
        )
        .options(selectinload(ChatRoomMember.user))
    )
    pending = result.scalars().all()
    return [ChatRoomMemberResponse.model_validate(m) for m in pending]
