from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func, desc
from sqlalchemy.orm import selectinload
import json

from ..database import get_db
from ..models.message import Message, Poll, PollOption, PollVote
from ..models.chat_room import ChatRoom, ChatRoomMember
from ..models.user import User
from ..schemas.message import (
    ChatRoomCreate,
    ChatRoomUpdate,
    ChatRoomResponse,
    ChatRoomBrief,
    ChatRoomMemberResponse,
    MessageCreate,
    MessageResponse,
    ConversationResponse,
    PollCreate,
    PollVoteRequest,
    PollOptionResponse,
    PollResponse,
)
from ..middleware.auth import get_current_user
from ..middleware.roles import require_role

router = APIRouter()


def serialize_poll(poll: Poll, user_id: str) -> PollResponse:
    total_votes = sum(len(opt.votes) for opt in poll.options)
    my_votes = []
    options_out = []
    for opt in poll.options:
        voted_by_me = any(v.user_id == user_id for v in opt.votes)
        if voted_by_me:
            my_votes.append(opt.id)
        options_out.append(
            PollOptionResponse(
                id=opt.id,
                label=opt.label,
                option_index=opt.option_index,
                votes_count=len(opt.votes),
                voted_by_me=voted_by_me,
            )
        )
    return PollResponse(
        id=poll.id,
        question=poll.question,
        multi_choice=poll.multi_choice,
        total_votes=total_votes,
        options=options_out,
        my_option_ids=my_votes,
    )


async def serialize_message(
    db: AsyncSession, msg: Message, current_user_id: str
) -> MessageResponse:
    poll_data = None
    if msg.kind == "poll" and msg.poll:
        poll_data = serialize_poll(msg.poll, current_user_id)
    metadata = None
    if msg.metadata_json:
        try:
            metadata = json.loads(msg.metadata_json)
        except Exception:
            pass
    return MessageResponse(
        id=msg.id,
        sender_id=msg.sender_id,
        receiver_id=msg.receiver_id,
        room_id=msg.room_id,
        kind=msg.kind,
        body=msg.body,
        attachment_url=msg.attachment_url,
        attachment_type=msg.attachment_type,
        attachment_name=msg.attachment_name,
        metadata=metadata,
        read=msg.read,
        created_at=msg.created_at,
        sender=msg.sender,
        receiver=msg.receiver,
        room=None,
        poll=poll_data,
    )


def serialize_room(room: ChatRoom, user_id: str) -> ChatRoomResponse:
    members_out = []
    for m in room.members:
        members_out.append(
            ChatRoomMemberResponse(
                id=m.id,
                room_id=m.room_id,
                user_id=m.user_id,
                role=m.role,
                joined_at=m.joined_at,
                user=m.user,
            )
        )
    return ChatRoomResponse(
        id=room.id,
        name=room.name,
        description=room.description,
        avatar_url=room.avatar_url,
        type=room.type,
        created_by=room.created_by,
        created_at=room.created_at,
        members=members_out,
    )


async def build_conversations(
    db: AsyncSession, current_user: User
) -> List[ConversationResponse]:
    result = await db.execute(
        select(Message)
        .options(selectinload(Message.sender))
        .where(
            or_(
                Message.sender_id == current_user.id,
                Message.receiver_id == current_user.id,
            )
        )
        .order_by(Message.created_at.desc())
    )
    dms = result.scalars().all()

    room_result = await db.execute(
        select(ChatRoom)
        .join(ChatRoomMember, ChatRoom.id == ChatRoomMember.room_id)
        .where(ChatRoomMember.user_id == current_user.id)
        .options(selectinload(ChatRoom.members).selectinload(ChatRoomMember.user))
    )
    rooms = room_result.scalars().all()

    dm_map = {}
    for msg in dms:
        other_id = (
            msg.receiver_id if msg.sender_id == current_user.id else msg.sender_id
        )
        if not other_id:
            continue
        if other_id not in dm_map:
            other_result = await db.execute(
                select(User).where(User.id == other_id)
            )
            other = other_result.scalar_one_or_none()
            if other:
                dm_map[other_id] = ConversationResponse(
                    type="direct",
                    id=other.id,
                    name=other.name,
                    avatar_url=other.avatar_url,
                    subtitle=other.house,
                    last_message=await serialize_message(db, msg, current_user.id),
                    unread_count=0,
                )
        if msg.receiver_id == current_user.id and not msg.read:
            dm_map[other_id].unread_count += 1

    room_convs = []
    for room in rooms:
        msg_result = await db.execute(
            select(Message)
            .where(Message.room_id == room.id)
            .order_by(Message.created_at.desc())
            .limit(1)
            .options(selectinload(Message.sender))
        )
        last_msg = msg_result.scalars().first()
        unread = 0
        if last_msg:
            count_result = await db.execute(
                select(func.count(Message.id)).where(
                    and_(
                        Message.room_id == room.id,
                        Message.sender_id != current_user.id,
                        Message.read == False,
                    )
                )
            )
            unread = count_result.scalar() or 0

        room_convs.append(
            ConversationResponse(
                type="room",
                id=room.id,
                name=room.name,
                avatar_url=room.avatar_url,
                subtitle=f"{len(room.members)} miembros",
                last_message=(
                    await serialize_message(db, last_msg, current_user.id)
                    if last_msg
                    else None
                ),
                unread_count=unread,
            )
        )

    all_convs = list(dm_map.values()) + room_convs
    all_convs.sort(
        key=lambda c: c.last_message.created_at if c.last_message else datetime.min,
        reverse=True,
    )
    return all_convs


@router.get("/conversations", response_model=List[ConversationResponse])
async def get_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await build_conversations(db, current_user)


@router.get("/{user_id}", response_model=List[MessageResponse])
async def get_messages(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Message)
        .options(selectinload(Message.sender), selectinload(Message.receiver))
        .where(
            or_(
                and_(
                    Message.sender_id == current_user.id,
                    Message.receiver_id == user_id,
                ),
                and_(
                    Message.sender_id == user_id,
                    Message.receiver_id == current_user.id,
                ),
            )
        )
        .order_by(Message.created_at.asc())
    )
    messages = result.scalars().all()

    for msg in messages:
        if msg.receiver_id == current_user.id and not msg.read:
            msg.read = True

    await db.commit()

    return [await serialize_message(db, msg, current_user.id) for msg in messages]


@router.post("/", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    message_data: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if message_data.receiver_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot send message to yourself",
        )

    receiver = None
    if message_data.receiver_id:
        receiver_result = await db.execute(
            select(User).where(User.id == message_data.receiver_id)
        )
        receiver = receiver_result.scalar_one_or_none()
        if not receiver:
            raise HTTPException(status_code=404, detail="Receiver not found")

    room = None
    if message_data.room_id:
        member_result = await db.execute(
            select(ChatRoomMember).where(
                and_(
                    ChatRoomMember.room_id == message_data.room_id,
                    ChatRoomMember.user_id == current_user.id,
                )
            )
        )
        if not member_result.scalar_one_or_none():
            raise HTTPException(
                status_code=403, detail="Not a member of this chat room"
            )
        room_result = await db.execute(
            select(ChatRoom).where(ChatRoom.id == message_data.room_id)
        )
        room = room_result.scalar_one_or_none()

    metadata_json = None
    if message_data.metadata:
        metadata_json = json.dumps(message_data.metadata)

    message = Message(
        sender_id=current_user.id,
        receiver_id=message_data.receiver_id,
        room_id=message_data.room_id,
        kind=message_data.kind or "text",
        body=message_data.body,
        attachment_url=message_data.attachment_url,
        attachment_type=message_data.attachment_type,
        attachment_name=message_data.attachment_name,
        metadata_json=metadata_json,
    )
    db.add(message)
    await db.flush()

    if message_data.kind == "poll" and message_data.poll:
        poll_data = message_data.poll
        poll = Poll(
            message_id=message.id,
            question=poll_data.question,
            multi_choice=poll_data.multi_choice,
        )
        db.add(poll)
        await db.flush()
        for idx, label in enumerate(poll_data.options):
            option = PollOption(
                poll_id=poll.id,
                label=label,
                option_index=idx,
            )
            db.add(option)

    await db.commit()
    await db.refresh(message)

    if message.poll:
        await db.refresh(message.poll)
        for opt in message.poll.options:
            await db.refresh(opt)

    return await serialize_message(db, message, current_user.id)


@router.post(
    "/rooms", response_model=ChatRoomResponse, status_code=status.HTTP_201_CREATED
)
async def create_chat_room(
    room_data: ChatRoomCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
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

    member_result = await db.execute(
        select(ChatRoomMember)
        .where(ChatRoomMember.room_id == room.id)
        .options(selectinload(ChatRoomMember.user))
    )
    room.members = member_result.scalars().all()

    return serialize_room(room, current_user.id)


@router.get("/rooms", response_model=List[ChatRoomBrief])
async def list_my_rooms(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ChatRoom)
        .join(ChatRoomMember, ChatRoom.id == ChatRoomMember.room_id)
        .where(ChatRoomMember.user_id == current_user.id)
        .options(selectinload(ChatRoom.members))
    )
    rooms = result.scalars().all()
    return [
        ChatRoomBrief(
            id=r.id,
            name=r.name,
            description=r.description,
            avatar_url=r.avatar_url,
            type=r.type,
            created_by=r.created_by,
            created_at=r.created_at,
            member_count=len(r.members),
        )
        for r in rooms
    ]


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


@router.get("/rooms/{room_id}/messages", response_model=List[MessageResponse])
async def get_room_messages(
    room_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=100),
    before: Optional[str] = None,
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

    query = (
        select(Message)
        .where(Message.room_id == room_id)
        .options(selectinload(Message.sender), selectinload(Message.poll).selectinload(Poll.options).selectinload(PollOption.votes))
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    if before:
        query = query.where(Message.id != before)

    result = await db.execute(query)
    messages = result.scalars().all()

    for msg in messages:
        if msg.sender_id != current_user.id and not msg.read:
            msg.read = True

    await db.commit()

    out = [await serialize_message(db, msg, current_user.id) for msg in messages]
    out.reverse()
    return out


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
    await db.commit()
    await db.refresh(member)
    member.user = user
    return ChatRoomMemberResponse.model_validate(member)


@router.delete("/rooms/{room_id}/members/{member_id}", status_code=204)
async def remove_room_member(
    room_id: str,
    member_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
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

    await db.delete(member)
    await db.commit()


@router.put("/rooms/{room_id}", response_model=ChatRoomResponse)
async def update_chat_room(
    room_id: str,
    room_data: ChatRoomUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(
        select(ChatRoom).where(ChatRoom.id == room_id)
    )
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    for key, value in room_data.model_dump(exclude_unset=True).items():
        setattr(room, key, value)

    await db.commit()
    await db.refresh(room)

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
):
    result = await db.execute(select(ChatRoom).where(ChatRoom.id == room_id))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    await db.delete(room)
    await db.commit()


@router.post("/messages/{message_id}/poll/vote")
async def vote_poll(
    message_id: str,
    vote_data: PollVoteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msg_result = await db.execute(
        select(Message)
        .where(Message.id == message_id)
        .options(
            selectinload(Message.poll).selectinload(Poll.options).selectinload(PollOption.votes)
        )
    )
    message = msg_result.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    if message.kind != "poll" or not message.poll:
        raise HTTPException(status_code=400, detail="Not a poll message")

    poll = message.poll
    if not poll.multi_choice and len(vote_data.option_ids) > 1:
        raise HTTPException(status_code=400, detail="Single choice poll")

    for option_id in vote_data.option_ids:
        opt_result = await db.execute(
            select(PollOption).where(PollOption.id == option_id)
        )
        option = opt_result.scalar_one_or_none()
        if not option or option.poll_id != poll.id:
            raise HTTPException(status_code=400, detail="Invalid option")

        existing = await db.execute(
            select(PollVote).where(
                and_(
                    PollVote.poll_id == poll.id,
                    PollVote.user_id == current_user.id,
                )
            )
        )
        if not poll.multi_choice and existing.scalar_one_or_none():
            await db.delete(existing.scalar_one_or_none())

        vote = PollVote(poll_id=poll.id, option_id=option_id, user_id=current_user.id)
        db.add(vote)

    await db.commit()
    return {"ok": True}


@router.delete("/messages/{message_id}/poll/vote")
async def remove_poll_vote(
    message_id: str,
    option_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msg_result = await db.execute(
        select(Message)
        .where(Message.id == message_id)
        .options(selectinload(Message.poll))
    )
    message = msg_result.scalar_one_or_none()
    if not message or message.kind != "poll" or not message.poll:
        raise HTTPException(status_code=404, detail="Poll not found")

    result = await db.execute(
        select(PollVote).where(
            and_(
                PollVote.poll_id == message.poll.id,
                PollVote.option_id == option_id,
                PollVote.user_id == current_user.id,
            )
        )
    )
    vote = result.scalar_one_or_none()
    if not vote:
        raise HTTPException(status_code=404, detail="Vote not found")

    await db.delete(vote)
    await db.commit()
    return {"ok": True}