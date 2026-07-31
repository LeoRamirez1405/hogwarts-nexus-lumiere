from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func, desc, update
from sqlalchemy.orm import selectinload
import json
import io
import tempfile
import os
import re
import cloudinary.uploader

from pathlib import Path

from ..database import get_db
from ..config import settings
from ..models.message import Message, Poll, PollOption, PollVote, MessageReaction
from ..models.chat_room import ChatRoom, ChatRoomMember, UserConversationPreference
from ..models.user import User
from ..models.article_subscription import Notification
from ..notifications_service import notify, resolve_mentions, N
from ..schemas.message import (
    ChatRoomCreate,
    ChatRoomUpdate,
    ChatRoomResponse,
    ChatRoomBrief,
    ChatRoomMemberResponse,
    MessageCreate,
    MessageResponse,
    MessagePage,
    ConversationResponse,
    PollCreate,
    PollVoteRequest,
    PollOptionResponse,
    PollResponse,
    ReactionCreate,
    MessageReactionResponse,
    MuteRequest,
    UserSearchResult,
)
from ..schemas.pagination import Page
from ..middleware.auth import get_current_user
from ..middleware.roles import require_role
from .audit_logs import log_audit

UPLOAD_DIR = Path("uploads")


def _delete_attachment_file(attachment_url: Optional[str]) -> None:
    """Best-effort removal of an uploaded file referenced by a message.
    
    Handles both local file paths (for backward compatibility) and Cloudinary URLs.
    """
    if not attachment_url:
        return
    
    # Handle local file paths (backward compatibility)
    if attachment_url.startswith("http://localhost:8000/uploads/") or \
       attachment_url.startswith("/uploads/"):
        # Extract filename from URL
        if attachment_url.startswith("http://localhost:8000/uploads/"):
            filename = attachment_url[len("http://localhost:8000/uploads/"):]
        else:  # starts with /uploads/
            filename = attachment_url[len("/uploads/"):]
        
        if not filename:
            return
            
        filepath = UPLOAD_DIR / filename
        try:
            if filepath.exists() and filepath.is_file():
                filepath.unlink()
        except OSError:
            pass
    
    # Handle Cloudinary URLs
    elif "res.cloudinary.com" in attachment_url:
        try:
            # Extract public_id from Cloudinary URL
            # Format: https://res.cloudinary.com/<cloud_name>/image/upload/v1234567890/public_id.extension
            # or: https://res.cloudinary.com/<cloud_name>/<resource_type>/<upload_type>/v1234567890/public_id.extension
            import re
            # Match pattern: /<resource_type>/<upload_type>/v<timestamp>/<public_id>.<extension>
            # or: /<resource_type>/<upload_type>/<public_id>.<extension>
            match = re.search(r'/([^/]+/[^/]+/v\d+_/)?([^/]+?)\.[^/]+$', attachment_url)
            if match:
                public_id = match.group(2)  # The public_id part
                # Full public_id includes the folder prefix
                full_public_id = f"nexus_uploads/{public_id}"
                
                # Delete from Cloudinary
                cloudinary.uploader.destroy(full_public_id, resource_type="auto")
        except Exception:
            # Best effort - don't fail the retention sweep if Cloudinary deletion fails
            pass

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

    reply_to_data = None
    if msg.reply_to_id and msg.reply_to:
        reply_to_data = await serialize_message(db, msg.reply_to, current_user_id)

    reactions_out = []
    for r in (msg.reactions or []):
        reactions_out.append(
            MessageReactionResponse(
                id=r.id,
                message_id=r.message_id,
                user_id=r.user_id,
                emoji=r.emoji,
                created_at=r.created_at,
            )
        )

    return MessageResponse(
        id=msg.id,
        sender_id=msg.sender_id,
        receiver_id=msg.receiver_id,
        room_id=msg.room_id,
        reply_to_id=msg.reply_to_id,
        kind=msg.kind,
        body=msg.body,
        attachment_url=msg.attachment_url,
        attachment_type=msg.attachment_type,
        attachment_name=msg.attachment_name,
        metadata=metadata,
        read=msg.read,
        pinned=bool(msg.pinned),
        created_at=msg.created_at,
        sender=msg.sender,
        receiver=msg.receiver,
        room=None,
        poll=poll_data,
        reply_to=reply_to_data,
        reactions=reactions_out,
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
                muted_until=m.muted_until,
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
        closed=room.closed,
        created_by=room.created_by,
        created_at=room.created_at,
        members=members_out,
    )


async def build_conversations(
    db: AsyncSession, current_user: User
) -> List[ConversationResponse]:
    # Get hidden conversation IDs and DM mute status for this user
    prefs_result = await db.execute(
        select(UserConversationPreference).where(
            and_(
                UserConversationPreference.user_id == current_user.id,
            )
        )
    )
    all_prefs = prefs_result.scalars().all()
    hidden_dm_ids = {p.conversation_id for p in all_prefs if p.hidden and p.conversation_type == "dm"}
    hidden_room_ids = {p.conversation_id for p in all_prefs if p.hidden and p.conversation_type == "room"}
    # map dm-user-id -> muted_until (only if still active)
    muted_dm: dict[str, Optional[datetime]] = {}
    for p in all_prefs:
        if p.conversation_type == "dm" and p.muted_until is not None:
            if p.muted_until > datetime.utcnow():
                muted_dm[p.conversation_id] = p.muted_until
            elif p.muted_until <= datetime.utcnow():
                # expired mute: clear it lazily
                p.muted_until = None

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
        .options(
            selectinload(ChatRoom.members).selectinload(ChatRoomMember.user),
        )
    )
    rooms = room_result.scalars().all()

    # Load this user's room memberships (mute status + last-read marker)
    membership_result = await db.execute(
        select(ChatRoomMember).where(ChatRoomMember.user_id == current_user.id)
    )
    muted_rooms = {}
    last_read_map = {}
    for m in membership_result.scalars().all():
        if m.muted_until is not None:
            muted_rooms[m.room_id] = m.muted_until
        last_read_map[m.room_id] = m.last_read_at

    dm_map = {}
    for msg in dms:
        other_id = (
            msg.receiver_id if msg.sender_id == current_user.id else msg.sender_id
        )
        if not other_id:
            continue
        if other_id in hidden_dm_ids:
            continue
        if other_id not in dm_map:
            other_result = await db.execute(
                select(User).where(User.id == other_id)
            )
            other = other_result.scalar_one_or_none()
            if other:
                dm_is_muted = other_id in muted_dm
                dm_map[other_id] = ConversationResponse(
                    type="direct",
                    id=other.id,
                    name=other.name,
                    avatar_url=other.avatar_url,
                    subtitle=other.house,
                    last_message=await serialize_message(db, msg, current_user.id),
                    unread_count=0,
                    is_muted=dm_is_muted,
                    last_active_at=other.last_active_at,
                )
        if msg.receiver_id == current_user.id and not msg.read:
            dm_map[other_id].unread_count += 1

    room_convs = []
    for room in rooms:
        if room.id in hidden_room_ids:
            continue
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
            last_read = last_read_map.get(room.id)
            count_filters = [
                Message.room_id == room.id,
                Message.sender_id != current_user.id,
            ]
            if last_read is not None:
                count_filters.append(Message.created_at > last_read)
            count_result = await db.execute(
                select(func.count(Message.id)).where(and_(*count_filters))
            )
            unread = count_result.scalar() or 0

        is_muted = False
        if room.id in muted_rooms:
            mu = muted_rooms[room.id]
            if mu is None or mu > datetime.utcnow():
                is_muted = True

        now = datetime.utcnow()
        online_count = sum(
            1 for m in room.members
            if m.user and m.user.last_active_at
            and (now - m.user.last_active_at).total_seconds() < 300
        )

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
                unread_count=unread if not is_muted else 0,
                online_count=online_count,
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


async def create_mention_notifications(
    db: AsyncSession,
    sender: User,
    body: str,
    room_name: str,
    room_id: str,
    message_id: str,
):
    """Notify every user "@mentioned" in a room message (resolution lives in the
    shared notifications_service)."""
    for mentioned_user in await resolve_mentions(db, body):
        await notify(
            db,
            user_id=mentioned_user.id,
            type=N.MENTION,
            title=f"@{sender.name} te mencionó en {room_name}",
            body=body[:200],
            # related_id encodes the jump target: "<room_id>:<message_id>"
            related_id=f"{room_id}:{message_id}",
            actor_id=sender.id,
        )


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
        if room and room.closed and current_user.role != "admin":
            raise HTTPException(
                status_code=403, detail="This room is closed by an administrator"
            )

    metadata_json = None
    if message_data.metadata:
        metadata_json = json.dumps(message_data.metadata)

    reply_to_id = message_data.reply_to_id

    message = Message(
        sender_id=current_user.id,
        receiver_id=message_data.receiver_id,
        room_id=message_data.room_id,
        reply_to_id=reply_to_id,
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

    notified = False
    # Create mention notifications for room messages
    if message.room_id and message.body and "@" in message.body:
        room_result2 = await db.execute(
            select(ChatRoom).where(ChatRoom.id == message.room_id)
        )
        room_obj = room_result2.scalar_one_or_none()
        room_name = room_obj.name if room_obj else "el grupo"
        await create_mention_notifications(
            db, current_user, message.body, room_name, message.room_id, message.id
        )
        notified = True

    # Direct message: let the recipient know they got a new message.
    if message.receiver_id and not message.room_id:
        preview = (message.body or "").strip()
        if not preview:
            preview = "Te envió un adjunto" if message.attachment_url else "Nuevo mensaje"
        await notify(
            db,
            user_id=message.receiver_id,
            type=N.DM_MESSAGE,
            title=f"Nuevo mensaje de {current_user.name}",
            body=preview[:200],
            related_id=current_user.id,
            actor_id=current_user.id,
        )
        notified = True

    if notified:
        await db.commit()

    return await serialize_message(db, message, current_user.id)


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


async def _resolve_cursor(db: AsyncSession, before: Optional[str]):
    """Turn a `before` message id into a (created_at, id) keyset cursor.

    Returns None when there is no cursor (initial load) or the referenced
    message no longer exists (e.g. it was purged) — callers then just return
    the newest page.
    """
    if not before:
        return None
    row = (
        await db.execute(
            select(Message.created_at, Message.id).where(Message.id == before)
        )
    ).first()
    return row  # (created_at, id) or None


def _older_than(cursor):
    """Keyset predicate: strictly older than the cursor (created_at, id)."""
    created_at, mid = cursor
    return or_(
        Message.created_at < created_at,
        and_(Message.created_at == created_at, Message.id < mid),
    )


_ROOM_MSG_OPTS = (
    selectinload(Message.sender),
    selectinload(Message.poll).selectinload(Poll.options).selectinload(PollOption.votes),
    selectinload(Message.reply_to).selectinload(Message.sender),
    selectinload(Message.reactions),
)

# On the initial load we expand the page so the unread divider (plus a little
# read context above it) is included and every unread message is visible below
# it — the client then lazy-loads older read history upward. Capped so a huge
# backlog never triggers a giant single query.
INITIAL_UNREAD_CONTEXT = 10
INITIAL_MAX = 100


def _initial_limit(limit: int, unread_count: int, has_first_unread: bool) -> int:
    """Widen the first page to cover all unread messages + some context."""
    if not has_first_unread or unread_count <= 0:
        return limit
    return min(max(limit, unread_count + INITIAL_UNREAD_CONTEXT), INITIAL_MAX)


@router.get("/rooms/{room_id}/messages", response_model=MessagePage)
async def get_room_messages(
    room_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(30, ge=1, le=100),
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
    query = (
        select(Message)
        .where(Message.room_id == room_id)
        .options(*_ROOM_MSG_OPTS)
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

    out = [await serialize_message(db, m, current_user.id) for m in rows]
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


@router.post("/{message_id}/reactions", response_model=MessageReactionResponse, status_code=status.HTTP_201_CREATED)
async def add_reaction(
    message_id: str,
    reaction_data: ReactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msg_result = await db.execute(select(Message).where(Message.id == message_id))
    message = msg_result.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    existing = await db.execute(
        select(MessageReaction).where(
            and_(
                MessageReaction.message_id == message_id,
                MessageReaction.user_id == current_user.id,
                MessageReaction.emoji == reaction_data.emoji,
            )
        )
    )
    existing_reaction = existing.scalar_one_or_none()
    if existing_reaction:
        await db.delete(existing_reaction)
        await db.commit()
        return {"id": existing_reaction.id, "message_id": message_id, "user_id": current_user.id, "emoji": reaction_data.emoji, "created_at": existing_reaction.created_at, "removed": True}

    reaction = MessageReaction(
        message_id=message_id,
        user_id=current_user.id,
        emoji=reaction_data.emoji,
    )
    db.add(reaction)
    await db.commit()
    await db.refresh(reaction)
    return MessageReactionResponse(
        id=reaction.id,
        message_id=reaction.message_id,
        user_id=reaction.user_id,
        emoji=reaction.emoji,
        created_at=reaction.created_at,
    )


@router.delete("/{message_id}/reactions/{emoji}", status_code=204)
async def remove_reaction(
    message_id: str,
    emoji: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(MessageReaction).where(
            and_(
                MessageReaction.message_id == message_id,
                MessageReaction.user_id == current_user.id,
                MessageReaction.emoji == emoji,
            )
        )
    )
    reaction = result.scalar_one_or_none()
    if not reaction:
        raise HTTPException(status_code=404, detail="Reaction not found")

    await db.delete(reaction)
    await db.commit()


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


@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    import speech_recognition as sr
    from pydub import AudioSegment

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")

    tmp_path = None
    wav_path = None
    try:
        suffix = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
        tmp_path = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tmp_path.write(content)
        tmp_path.close()

        wav_path = tmp_path.name + ".wav"
        try:
            audio = AudioSegment.from_file(tmp_path.name)
            audio = audio.set_frame_rate(16000).set_channels(1)
            audio.export(wav_path, format="wav")
        except Exception:
            wav_path = tmp_path.name

        recognizer = sr.Recognizer()
        with sr.AudioFile(wav_path) as source:
            audio_data = recognizer.record(source)

        text = recognizer.recognize_google(audio_data, language="es-ES")
        return {"text": text}

    except sr.UnknownValueError:
        raise HTTPException(status_code=422, detail="No se pudo reconocer el audio")
    except sr.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Servicio de reconocimiento no disponible: {e}")
    finally:
        if tmp_path and os.path.exists(tmp_path.name):
            os.unlink(tmp_path.name)
        if wav_path and os.path.exists(wav_path) and (not tmp_path or wav_path != tmp_path.name):
            os.unlink(wav_path)


@router.post("/conversations/{conv_type}/{conv_id}/hide")
async def hide_conversation(
    conv_type: str,
    conv_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if conv_type not in ("dm", "room"):
        raise HTTPException(status_code=400, detail="conv_type must be 'dm' or 'room'")

    existing = await db.execute(
        select(UserConversationPreference).where(
            and_(
                UserConversationPreference.user_id == current_user.id,
                UserConversationPreference.conversation_type == conv_type,
                UserConversationPreference.conversation_id == conv_id,
            )
        )
    )
    pref = existing.scalar_one_or_none()
    if pref:
        pref.hidden = True
    else:
        pref = UserConversationPreference(
            user_id=current_user.id,
            conversation_type=conv_type,
            conversation_id=conv_id,
            hidden=True,
        )
        db.add(pref)

    await db.commit()
    return {"ok": True}


@router.delete("/conversations/{conv_type}/{conv_id}/hide")
async def unhide_conversation(
    conv_type: str,
    conv_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if conv_type not in ("dm", "room"):
        raise HTTPException(status_code=400, detail="conv_type must be 'dm' or 'room'")

    existing = await db.execute(
        select(UserConversationPreference).where(
            and_(
                UserConversationPreference.user_id == current_user.id,
                UserConversationPreference.conversation_type == conv_type,
                UserConversationPreference.conversation_id == conv_id,
            )
        )
    )
    pref = existing.scalar_one_or_none()
    if pref:
        pref.hidden = False
        await db.commit()

    return {"ok": True}


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


@router.put("/conversations/{conv_type}/{conv_id}/mute")
async def mute_conversation(
    conv_type: str,
    conv_id: str,
    mute_data: MuteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if conv_type not in ("dm", "room"):
        raise HTTPException(status_code=400, detail="conv_type must be 'dm' or 'room'")

    if duration := mute_data.duration:
        if duration == "off":
            muted_until = None
        elif duration == "8h":
            muted_until = datetime.utcnow() + timedelta(hours=8)
        elif duration == "24h":
            muted_until = datetime.utcnow() + timedelta(hours=24)
        elif duration == "forever":
            muted_until = datetime(2099, 12, 31, 23, 59, 59)
        else:
            raise HTTPException(status_code=400, detail="Invalid duration. Use: 8h, 24h, forever, off")
    else:
        raise HTTPException(status_code=400, detail="duration is required")

    existing = await db.execute(
        select(UserConversationPreference).where(
            and_(
                UserConversationPreference.user_id == current_user.id,
                UserConversationPreference.conversation_type == conv_type,
                UserConversationPreference.conversation_id == conv_id,
            )
        )
    )
    pref = existing.scalar_one_or_none()
    if pref:
        pref.muted_until = muted_until
    else:
        pref = UserConversationPreference(
            user_id=current_user.id,
            conversation_type=conv_type,
            conversation_id=conv_id,
            muted_until=muted_until,
        )
        db.add(pref)

    await db.commit()
    return {"ok": True, "muted_until": muted_until.isoformat() if muted_until else None}


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
        from ..models.friend_request import FriendRequest
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


@router.post("/admin/purge")
async def admin_purge_messages(
    days: Optional[int] = Query(None, ge=0),
    current_user: User = Depends(require_role("admin")),
):
    """Manually run the retention sweep. `days` overrides the configured
    window for this run; omit to use MESSAGE_RETENTION_DAYS."""
    from ..retention import purge_old_messages

    effective = settings.MESSAGE_RETENTION_DAYS if days is None else days
    result = await purge_old_messages(effective)
    return {"requested_days": effective, **result}


_PIN_OPTS = (
    selectinload(Message.sender),
    selectinload(Message.receiver),
    selectinload(Message.poll).selectinload(Poll.options).selectinload(PollOption.votes),
    selectinload(Message.reply_to).selectinload(Message.sender),
    selectinload(Message.reactions),
)


@router.put("/{message_id}/pin", response_model=MessageResponse)
async def toggle_pin(
    message_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msg = (
        await db.execute(
            select(Message).where(Message.id == message_id).options(*_PIN_OPTS)
        )
    ).scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    # Authorize: room members, or either side of the DM.
    if msg.room_id:
        member = (
            await db.execute(
                select(ChatRoomMember).where(
                    and_(
                        ChatRoomMember.room_id == msg.room_id,
                        ChatRoomMember.user_id == current_user.id,
                    )
                )
            )
        ).scalar_one_or_none()
        if not member:
            raise HTTPException(status_code=403, detail="Not a member of this room")
    elif current_user.id not in (msg.sender_id, msg.receiver_id):
        raise HTTPException(status_code=403, detail="Not part of this conversation")

    msg.pinned = not bool(msg.pinned)
    await db.commit()
    await db.refresh(msg)
    return await serialize_message(db, msg, current_user.id)


@router.get("/rooms/{room_id}/pinned", response_model=List[MessageResponse])
async def list_room_pinned(
    room_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = (
        await db.execute(
            select(ChatRoomMember).where(
                and_(
                    ChatRoomMember.room_id == room_id,
                    ChatRoomMember.user_id == current_user.id,
                )
            )
        )
    ).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this room")

    rows = (
        await db.execute(
            select(Message)
            .where(and_(Message.room_id == room_id, Message.pinned == True))  # noqa: E712
            .options(*_PIN_OPTS)
            .order_by(Message.created_at.desc())
        )
    ).scalars().all()
    return [await serialize_message(db, m, current_user.id) for m in rows]


@router.get("/dm/{user_id}/pinned", response_model=List[MessageResponse])
async def list_dm_pinned(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    convo_filter = or_(
        and_(Message.sender_id == current_user.id, Message.receiver_id == user_id),
        and_(Message.sender_id == user_id, Message.receiver_id == current_user.id),
    )
    rows = (
        await db.execute(
            select(Message)
            .where(and_(convo_filter, Message.pinned == True))  # noqa: E712
            .options(*_PIN_OPTS)
            .order_by(Message.created_at.desc())
        )
    ).scalars().all()
    return [await serialize_message(db, m, current_user.id) for m in rows]


@router.get("/{user_id}", response_model=MessagePage)
async def get_messages(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(30, ge=1, le=100),
    before: Optional[str] = None,
):
    convo_filter = or_(
        and_(
            Message.sender_id == current_user.id,
            Message.receiver_id == user_id,
        ),
        and_(
            Message.sender_id == user_id,
            Message.receiver_id == current_user.id,
        ),
    )

    # Unread marker only on the initial load (no cursor).
    first_unread_id = None
    unread_count = 0
    if not before:
        unread_filters = [
            Message.receiver_id == current_user.id,
            Message.sender_id == user_id,
            Message.read == False,  # noqa: E712
        ]
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
    query = (
        select(Message)
        .options(
            selectinload(Message.sender),
            selectinload(Message.receiver),
            selectinload(Message.reply_to).selectinload(Message.sender),
            selectinload(Message.reactions),
        )
        .where(convo_filter)
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

    # On the initial load, clear the whole unread badge for this DM (not only
    # the messages in this page), so the conversation list count resets.
    if not before:
        await db.execute(
            update(Message)
            .where(
                and_(
                    Message.receiver_id == current_user.id,
                    Message.sender_id == user_id,
                    Message.read == False,  # noqa: E712
                )
            )
            .values(read=True)
        )
    await db.commit()

    out = [await serialize_message(db, m, current_user.id) for m in rows]
    out.reverse()  # oldest-first for rendering
    return MessagePage(
        messages=out,
        has_more=has_more,
        first_unread_id=first_unread_id,
        unread_count=unread_count,
    )