"""Per-user room preferences: leave, mute, archive/unarchive."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....middleware.auth import get_current_user
from ....models.chat_room import ChatRoom, ChatRoomMember
from ....models.user import User
from ....schemas.message import MuteRequest

router = APIRouter()


@router.delete("/rooms/{room_id}/leave")
async def leave_room(
    room_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member_result = await db.execute(
        select(ChatRoomMember).where(
            and_(
                ChatRoomMember.room_id == room_id,
                ChatRoomMember.user_id == current_user.id,
            )
        )
    )
    member = member_result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="You are not a member of this room")

    # Check if user is the only admin
    if member.role == "admin":
        admin_count_result = await db.execute(
            select(func.count(ChatRoomMember.id)).where(
                and_(
                    ChatRoomMember.room_id == room_id,
                    ChatRoomMember.role == "admin",
                )
            )
        )
        admin_count = admin_count_result.scalar() or 0
        if admin_count <= 1:
            # Check if there are other members
            member_count_result = await db.execute(
                select(func.count(ChatRoomMember.id)).where(
                    ChatRoomMember.room_id == room_id
                )
            )
            member_count = member_count_result.scalar() or 0
            if member_count > 1:
                raise HTTPException(
                    status_code=400,
                    detail="Eres el unico administrador. Transfiere la administracion antes de salir.",
                )
            else:
                # Only member and admin, delete the room
                room_result = await db.execute(
                    select(ChatRoom).where(ChatRoom.id == room_id)
                )
                room = room_result.scalar_one_or_none()
                if room:
                    await db.delete(room)
                    await db.commit()
                    return {"ok": True, "room_deleted": True}

    await db.delete(member)
    await db.commit()
    return {"ok": True, "room_deleted": False}


@router.put("/rooms/{room_id}/mute")
async def mute_room(
    room_id: str,
    mute_data: MuteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member_result = await db.execute(
        select(ChatRoomMember).where(
            and_(
                ChatRoomMember.room_id == room_id,
                ChatRoomMember.user_id == current_user.id,
            )
        )
    )
    member = member_result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="You are not a member of this room")

    duration = mute_data.duration
    if duration == "off":
        member.muted_until = None
    elif duration == "8h":
        member.muted_until = datetime.utcnow() + timedelta(hours=8)
    elif duration == "24h":
        member.muted_until = datetime.utcnow() + timedelta(hours=24)
    elif duration == "forever":
        member.muted_until = datetime(2099, 12, 31, 23, 59, 59)
    else:
        raise HTTPException(status_code=400, detail="Invalid duration. Use: 8h, 24h, forever, off")

    await db.commit()
    return {"ok": True, "muted_until": member.muted_until.isoformat() if member.muted_until else None}


@router.put("/rooms/{room_id}/archive")
async def archive_room(
    room_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = (
        await db.execute(
            select(ChatRoomMember).where(
                and_(ChatRoomMember.room_id == room_id, ChatRoomMember.user_id == current_user.id)
            )
        )
    ).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this room")

    member.archived = True
    await db.commit()
    return {"ok": True}


@router.delete("/rooms/{room_id}/archive")
async def unarchive_room(
    room_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = (
        await db.execute(
            select(ChatRoomMember).where(
                and_(ChatRoomMember.room_id == room_id, ChatRoomMember.user_id == current_user.id)
            )
        )
    ).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this room")

    member.archived = False
    await db.commit()
    return {"ok": True}
