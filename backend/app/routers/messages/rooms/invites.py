"""Room invite-link endpoints.

Allows a room admin to mint shareable links, list/revoke them, and any
authenticated user to fetch the public info of an invite so the client can
display a "Te invitaron a X" preview before joining. Joining itself is
handled by :func:`join_room_by_invite`, which supports both direct and
approval-gated rooms with a single endpoint.
"""

import secrets
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ....database import get_db
from ....middleware.auth import get_current_user
from ....models.chat_room import ChatRoom, ChatRoomMember, RoomInvite
from ....models.user import User
from ....notifications_service import N, notify
from ....schemas.message import (
    RoomInviteCreate,
    RoomInviteInfoResponse,
    RoomInviteResponse,
)
from ...audit_logs import log_audit
from app.utils.dates import utcnow


router = APIRouter()


def _serialize_invite(inv: RoomInvite) -> RoomInviteResponse:
    return RoomInviteResponse(
        id=inv.id,
        room_id=inv.room_id,
        token=inv.token,
        created_by=inv.created_by,
        expires_at=inv.expires_at,
        max_uses=inv.max_uses,
        uses=inv.uses,
        revoked=inv.revoked,
        created_at=inv.created_at,
    )


def _room_admin_or_global_admin(
    current_user: User, room: ChatRoom, members: List[ChatRoomMember]
) -> bool:
    if current_user.role == "admin":
        return True
    return any(
        m.user_id == current_user.id and m.role == "admin" and not m.pending
        for m in members
    )


def _invite_is_expired(inv: RoomInvite) -> bool:
    return inv.expires_at is not None and inv.expires_at <= utcnow()


def _invite_uses_exhausted(inv: RoomInvite) -> bool:
    return inv.max_uses is not None and inv.uses >= inv.max_uses


@router.post(
    "/rooms/{room_id}/invites",
    response_model=RoomInviteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_room_invite(
    room_id: str,
    data: RoomInviteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    room_result = await db.execute(
        select(ChatRoom)
        .where(ChatRoom.id == room_id)
        .options(selectinload(ChatRoom.members))
    )
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if not _room_admin_or_global_admin(current_user, room, room.members):
        raise HTTPException(status_code=403, detail="Only room admins can create invites")
    if data.max_uses is not None and data.max_uses <= 0:
        raise HTTPException(status_code=400, detail="max_uses must be positive")
    if data.expires_at is not None and data.expires_at <= utcnow():
        raise HTTPException(status_code=400, detail="expires_at must be in the future")

    invite = RoomInvite(
        room_id=room_id,
        token=secrets.token_urlsafe(16),
        created_by=current_user.id,
        expires_at=data.expires_at,
        max_uses=data.max_uses,
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)

    await log_audit(
        db,
        actor=current_user,
        action="create_invite",
        entity_type="RoomInvite",
        entity_id=invite.id,
        details={"room_id": room_id, "max_uses": invite.max_uses, "expires_at": invite.expires_at.isoformat() if invite.expires_at else None},
        request=request,
    )

    return _serialize_invite(invite)


@router.get("/rooms/{room_id}/invites", response_model=List[RoomInviteResponse])
async def list_room_invites(
    room_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    room_result = await db.execute(
        select(ChatRoom)
        .where(ChatRoom.id == room_id)
        .options(selectinload(ChatRoom.members), selectinload(ChatRoom.invites))
    )
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if not _room_admin_or_global_admin(current_user, room, room.members):
        raise HTTPException(status_code=403, detail="Only room admins can list invites")
    return [
        _serialize_invite(inv)
        for inv in room.invites
        if not inv.revoked and not _invite_is_expired(inv)
    ]


@router.delete("/rooms/{room_id}/invites/{invite_id}", status_code=204)
async def revoke_room_invite(
    room_id: str,
    invite_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    room_result = await db.execute(
        select(ChatRoom)
        .where(ChatRoom.id == room_id)
        .options(selectinload(ChatRoom.members))
    )
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if not _room_admin_or_global_admin(current_user, room, room.members):
        raise HTTPException(status_code=403, detail="Only room admins can revoke invites")
    inv_result = await db.execute(
        select(RoomInvite).where(
            and_(RoomInvite.id == invite_id, RoomInvite.room_id == room_id)
        )
    )
    invite = inv_result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    invite.revoked = True
    await db.commit()

    await log_audit(
        db,
        actor=current_user,
        action="revoke_invite",
        entity_type="RoomInvite",
        entity_id=invite.id,
        details={"room_id": room_id, "token": invite.token[:8] + "..."},
        request=request,
    )


@router.get("/invites/{token}", response_model=RoomInviteInfoResponse)
async def get_invite_info(
    token: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Public preview shown before a user joins via the link."""
    inv_result = await db.execute(
        select(RoomInvite).where(RoomInvite.token == token)
    )
    invite = inv_result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    room_result = await db.execute(
        select(ChatRoom)
        .where(ChatRoom.id == invite.room_id)
        .options(selectinload(ChatRoom.members))
    )
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return RoomInviteInfoResponse(
        room_id=room.id,
        room_name=room.name,
        room_avatar_url=room.avatar_url,
        member_count=len(room.members),
        requires_approval=bool(getattr(room, "join_approval", False)),
        expired=_invite_is_expired(invite),
        revoked=invite.revoked,
        uses_exhausted=_invite_uses_exhausted(invite),
    )


@router.post("/invites/{token}/join", response_model=RoomInviteInfoResponse)
async def join_room_by_invite(
    token: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    """Join (or request to join when approval is required) a room via an invite link."""
    inv_result = await db.execute(
        select(RoomInvite).where(RoomInvite.token == token)
    )
    invite = inv_result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.revoked:
        raise HTTPException(status_code=410, detail="Invite has been revoked")
    if _invite_is_expired(invite):
        raise HTTPException(status_code=410, detail="Invite has expired")
    if _invite_uses_exhausted(invite):
        raise HTTPException(status_code=410, detail="Invite has reached its maximum uses")

    room_result = await db.execute(
        select(ChatRoom)
        .where(ChatRoom.id == invite.room_id)
        .options(selectinload(ChatRoom.members))
    )
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.closed:
        raise HTTPException(status_code=403, detail="Group is closed")

    existing = next(
        (m for m in room.members if m.user_id == current_user.id), None
    )
    added_member = False
    if existing and not existing.pending:
        return RoomInviteInfoResponse(
            room_id=room.id,
            room_name=room.name,
            room_avatar_url=room.avatar_url,
            member_count=len(room.members),
            requires_approval=bool(getattr(room, "join_approval", False)),
            expired=False,
            revoked=False,
            uses_exhausted=False,
        )

    needs_approval = bool(getattr(room, "join_approval", False))
    if not existing:
        member = ChatRoomMember(
            room_id=room.id,
            user_id=current_user.id,
            role="member",
            pending=needs_approval,
        )
        db.add(member)
        added_member = True
        if not needs_approval:
            invite.uses = (invite.uses or 0) + 1

    # Notify room admins
    admin_members = [
        m for m in room.members
        if m.role == "admin" and not m.pending
    ]
    notif_type = N.GROUP_JOIN_REQUEST if needs_approval else N.GROUP_ADDED
    notif_title = (
        "Nueva solicitud de union" if needs_approval else "Nuevo miembro"
    )
    notif_body = (
        f"{current_user.name} solicito unirse a {room.name}."
        if needs_approval
        else f"{current_user.name} se unio a {room.name}."
    )
    for admin in admin_members:
        await notify(
            db,
            user_id=admin.user_id,
            type=notif_type,
            title=notif_title,
            body=notif_body,
            related_id=room.id,
            actor_id=current_user.id,
        )

    await db.commit()

    await log_audit(
        db,
        actor=current_user,
        action="join_room",
        entity_type="ChatRoom",
        entity_id=room.id,
        details={
            "room_name": room.name,
            "via_invite": True,
            "pending": needs_approval,
        },
        request=request,
    )

    return RoomInviteInfoResponse(
        room_id=room.id,
        room_name=room.name,
        room_avatar_url=room.avatar_url,
        member_count=len(room.members) + (1 if added_member else 0),
        requires_approval=needs_approval,
        expired=False,
        revoked=False,
        uses_exhausted=False,
    )
