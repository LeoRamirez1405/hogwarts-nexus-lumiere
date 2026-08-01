"""Chat room management and room-scoped messaging endpoints."""

from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...database import get_db
from ...middleware.auth import get_current_user
from ...middleware.roles import require_role
from ...models.chat_room import ChatRoom, ChatRoomMember
from ...models.message import Message, Poll, PollOption
from ...models.user import User
from ...notifications_service import notify, N
from ...schemas.message import (
    ChatRoomBrief,
    ChatRoomCreate,
    ChatRoomMemberResponse,
    ChatRoomResponse,
    ChatRoomUpdate,
    MessageCreate,
    MessagePage,
    MessageResponse,
    MuteRequest,
)
from ...schemas.pagination import Page
from ..audit_logs import log_audit
from .core import send_message
from .deps import _initial_limit, _older_than, _resolve_cursor
from .serializers import serialize_message, serialize_room

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
                created_by=r.created_by,
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


@router.get("/rooms/{room_id}/messages", response_model=MessagePage)
async def get_room_messages(
    room_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(30, ge=1, le=100),
    before: Optional[str] = None,
    expand: str = Query("", description="Comma-separated list of relations to expand: sender,receiver,reactions,reply_to"),
):
    expand_sender = "sender" in expand
    expand_receiver = "receiver" in expand
    expand_reactions = "reactions" in expand
    expand_reply_to = "reply_to" in expand

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
        raise HTTPException(status_code=403, detail="Not a member of this room")

    # Unread marker is only meaningful on the initial load (no cursor).
    first_unread_id = None
    unread_count = 0
    last_read = member.last_read_at
    if not before:
        unread_filters = [
            Message.room_id == room_id,
            Message.sender_id != current_user.id,
        ]
        if last_read is not None:
            unread_filters.append(Message.created_at > last_read)
        first_unread_id = (
            await db.execute(
                select(Message.id)
                .where(and_(*unread_filters))
                .order_by(Message.created_at.asc(), Message.id.asc())
                .limit(1)
            )
        ).scalar_one_or_none()
        unread_count = (
            await db.execute(
                select(func.count(Message.id)).where(and_(*unread_filters))
            )
        ).scalar() or 0

    eff_limit = _initial_limit(limit, unread_count, first_unread_id is not None)

    # Build query with conditional eager loading based on expand
    query_options = []
    if expand_sender:
        query_options.append(selectinload(Message.sender))
    if expand_receiver:
        query_options.append(selectinload(Message.receiver))
    if expand_reactions:
        query_options.append(selectinload(Message.reactions))
    if expand_reply_to:
        query_options.append(selectinload(Message.reply_to).selectinload(Message.sender))

    # Always load poll for poll messages
    query_options.append(selectinload(Message.poll).selectinload(Poll.options).selectinload(PollOption.votes))

    query = (
        select(Message)
        .where(Message.room_id == room_id)
        .options(*query_options)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(eff_limit + 1)
    )
    cursor = await _resolve_cursor(db, before)
    if cursor is not None:
        query = query.where(_older_than(cursor))

    result = await db.execute(query)
    rows = result.scalars().all()
    has_more = len(rows) > eff_limit
    rows = rows[:eff_limit]

    # Advance this member's last-read marker on the initial load.
    if not before and rows:
        newest = max(m.created_at for m in rows)
        if member.last_read_at is None or newest > member.last_read_at:
            member.last_read_at = newest
    await db.commit()

    out = [
        await serialize_message(
            db, m, current_user.id,
            expand_sender=expand_sender, expand_receiver=expand_receiver,
            expand_reactions=expand_reactions, expand_reply_to=expand_reply_to,
        )
        for m in rows
    ]
    out.reverse()  # oldest-first for rendering
    return MessagePage(
        messages=out,
        has_more=has_more,
        first_unread_id=first_unread_id,
        unread_count=unread_count,
    )


@router.post(
    "/rooms/{room_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_room_message(
    room_id: str,
    message_data: MessageCreate,
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
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this room")

    message_data.room_id = room_id
    return await send_message(message_data, db, current_user)


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
