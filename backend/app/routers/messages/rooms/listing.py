"""Read-access endpoints for chat rooms: list rooms and fetch a single room."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ....database import get_db
from ....middleware.auth import get_current_user
from ....models.chat_room import ChatRoom, ChatRoomMember
from ....models.user import User
from ....schemas.message import ChatRoomBrief, ChatRoomResponse
from ....schemas.pagination import Page
from ..serializers import serialize_room

router = APIRouter()


@router.get("/rooms", response_model=Page[ChatRoomBrief])
async def list_my_rooms(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    all: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    if all and current_user.role == "admin":
        query = select(ChatRoom).options(selectinload(ChatRoom.members))
        count_query = select(func.count(ChatRoom.id))
    else:
        query = (
            select(ChatRoom)
            .join(ChatRoomMember, ChatRoom.id == ChatRoomMember.room_id)
            .where(ChatRoomMember.user_id == current_user.id)
            .options(selectinload(ChatRoom.members))
        )
        count_query = (
            select(func.count(ChatRoom.id))
            .join(ChatRoomMember, ChatRoom.id == ChatRoomMember.room_id)
            .where(ChatRoomMember.user_id == current_user.id)
        )
    result = await db.execute(query.offset(skip).limit(limit + 1))
    rooms = result.scalars().all()
    has_more = len(rooms) > limit
    rooms = rooms[:limit]
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()
    return Page(
        items=[
            ChatRoomBrief(
                id=r.id,
                name=r.name,
                description=r.description,
                avatar_url=r.avatar_url,
                type=r.type,
                closed=r.closed,
                join_approval=bool(getattr(r, "join_approval", False)),
                created_by=r.created_by,
                creator_name=r.creator.name if r.creator else None,
                created_at=r.created_at,
                member_count=len(r.members),
            )
            for r in rooms
        ],
        total=total,
        skip=skip,
        limit=limit,
        has_more=has_more,
    )


@router.get("/rooms/{room_id}", response_model=ChatRoomResponse)
async def get_chat_room(
    room_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Global admins can inspect any room (e.g. manage members/voice/events of
    # rooms created by other admins) without being a member themselves.
    if current_user.role != "admin":
        member_result = await db.execute(
            select(ChatRoomMember).where(
                and_(
                    ChatRoomMember.room_id == room_id,
                    ChatRoomMember.user_id == current_user.id,
                )
            )
        )
        if not member_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Not a member of this room")

    room_result = await db.execute(
        select(ChatRoom)
        .where(ChatRoom.id == room_id)
        .options(selectinload(ChatRoom.members).selectinload(ChatRoomMember.user))
    )
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    return serialize_room(room, current_user.id)
