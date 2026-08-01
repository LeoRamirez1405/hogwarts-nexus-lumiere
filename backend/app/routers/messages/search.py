"""Search endpoints for users and messages."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.chat_room import ChatRoomMember
from ...models.message import Message
from ...models.user import User
from ...schemas.message import MessageResponse, UserSearchResult
from .serializers import serialize_message

router = APIRouter()


@router.get("/users/search", response_model=List[UserSearchResult])
async def search_users(
    q: str = Query(..., min_length=1),
    friends_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(User).where(
        and_(
            User.id != current_user.id,
            User.name.ilike(f"%{q}%"),
        )
    )

    if friends_only:
        from ...models.friend_request import FriendRequest
        friend_ids_subq = (
            select(FriendRequest.sender_id)
            .where(
                and_(
                    FriendRequest.receiver_id == current_user.id,
                    FriendRequest.status == "accepted",
                )
            )
            .union(
                select(FriendRequest.receiver_id).where(
                    and_(
                        FriendRequest.sender_id == current_user.id,
                        FriendRequest.status == "accepted",
                    )
                )
            )
        )
        query = query.where(User.id.in_(friend_ids_subq))

    result = await db.execute(query.limit(10))
    users = result.scalars().all()

    return [
        UserSearchResult(id=u.id, name=u.name, avatar_url=u.avatar_url, house=u.house)
        for u in users
    ]


@router.get("/search", response_model=List[MessageResponse])
async def search_messages_global(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(25, ge=1, le=100),
):
    pattern = f"%{q}%"
    dm_filter = or_(
        and_(Message.sender_id == current_user.id),
        and_(Message.receiver_id == current_user.id),
    )
    room_subq = (
        select(ChatRoomMember.room_id).where(ChatRoomMember.user_id == current_user.id)
    )
    room_filter = Message.room_id.in_(room_subq)

    stmt = (
        select(Message)
        .options(
            selectinload(Message.sender),
            selectinload(Message.receiver),
            selectinload(Message.reactions),
            selectinload(Message.reply_to).selectinload(Message.sender),
        )
        .where(and_(or_(dm_filter, room_filter), Message.body.ilike(pattern)))
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [await serialize_message(db, m, current_user.id, expand_sender=True, expand_reactions=True) for m in rows]


@router.get("/rooms/{room_id}/messages/search", response_model=List[MessageResponse])
async def search_messages_in_room(
    room_id: str,
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=200),
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

    pattern = f"%{q}%"
    stmt = (
        select(Message)
        .options(
            selectinload(Message.sender),
            selectinload(Message.reactions),
            selectinload(Message.reply_to).selectinload(Message.sender),
        )
        .where(and_(Message.room_id == room_id, Message.body.ilike(pattern)))
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [await serialize_message(db, m, current_user.id, expand_sender=True, expand_reactions=True) for m in rows]
