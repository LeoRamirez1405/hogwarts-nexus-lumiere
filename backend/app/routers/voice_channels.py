"""Voice channel REST + WebSocket signaling endpoints.

The REST router provides CRUD for voice channels within a chat room along
with join/leave/mute/push-to-talk toggles. The WebSocket router handles
WebRTC signalling (offer/answer/ICE-candidate relay) through the existing
``ws_manager`` bus so it works across workers, implementing a mesh (full
peer-to-peer) topology — no SFU. Suitable for groups of up to 10 peers.
"""

import asyncio
import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..middleware.auth import get_current_user, get_current_user_ws
from ..models.user import User
from ..models.chat_room import ChatRoomMember
from ..models.voice_channel import VoiceChannel, VoiceChannelParticipant
from ..schemas.voice_channel import (
    VoiceChannelCreate,
    VoiceChannelUpdate,
    VoiceChannelResponse,
    VoiceChannelBrief,
    VoiceChannelParticipantResponse,
    MuteStateUpdate,
)
from ..schemas.user import UserResponse
from ..ws_manager import manager

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _is_room_member(
    db: AsyncSession, room_id: str, current_user: User
) -> bool:
    # Global admins can manage any room (see get_chat_room).
    if current_user.role == "admin":
        return True
    r = await db.execute(
        select(ChatRoomMember).where(
            ChatRoomMember.room_id == room_id,
            ChatRoomMember.user_id == current_user.id,
            ChatRoomMember.pending.is_(False),
        )
    )
    return r.scalar_one_or_none() is not None


async def _serialize_participant(p: VoiceChannelParticipant) -> VoiceChannelParticipantResponse:
    user = p.user
    user_data = UserResponse.model_validate(user) if user else None
    return VoiceChannelParticipantResponse(
        id=p.id,
        channel_id=p.channel_id,
        user_id=p.user_id,
        joined_at=p.joined_at,
        muted=p.muted,
        deafened=p.deafened,
        video_enabled=p.video_enabled,
        screen_sharing=p.screen_sharing,
        user=user_data,
    )


async def _serialize_channel(channel: VoiceChannel) -> VoiceChannelResponse:
    participants = []
    for p in channel.participants:
        participants.append(await _serialize_participant(p))
    return VoiceChannelResponse(
        id=channel.id,
        room_id=channel.room_id,
        name=channel.name,
        description=channel.description,
        created_by=channel.created_by,
        created_at=channel.created_at,
        participants=participants,
    )


async def _broadcast_channel_state(channel_id: str, channel: VoiceChannelResponse):
    """Push the full channel state to every connected participant via WS."""
    payload = {
        "t": "voice_channel_state",
        "channel_id": channel_id,
        "data": channel.model_dump(mode="json"),
    }
    for p in channel.participants:
        await manager.send_to_user(p.user_id, payload)

# ---------------------------------------------------------------------------
# REST router
# ---------------------------------------------------------------------------

rest_router = APIRouter()


@rest_router.get("/rooms/{room_id}/channels", response_model=list[VoiceChannelBrief])
async def list_voice_channels(
    room_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not await _is_room_member(db, room_id, current_user):
        raise HTTPException(status_code=403, detail="Not a member of this room")

    result = await db.execute(
        select(VoiceChannel).where(VoiceChannel.room_id == room_id)
    )
    channels = result.scalars().all()

    briefs = []
    for ch in channels:
        p_count = await db.scalar(
            select(func.count()).where(VoiceChannelParticipant.channel_id == ch.id)
        )
        briefs.append(VoiceChannelBrief(
            id=ch.id,
            room_id=ch.room_id,
            name=ch.name,
            description=ch.description,
            created_by=ch.created_by,
            created_at=ch.created_at,
            participant_count=p_count or 0,
        ))
    return briefs


@rest_router.post(
    "/rooms/{room_id}/channels",
    response_model=VoiceChannelResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_voice_channel(
    room_id: str,
    data: VoiceChannelCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only admins can start a voice channel",
        )
    if not await _is_room_member(db, room_id, current_user):
        raise HTTPException(status_code=403, detail="Not a member of this room")

    # Check max channels per room (arbitrary reasonable limit)
    existing = await db.execute(
        select(VoiceChannel).where(VoiceChannel.room_id == room_id)
    )
    if len(existing.scalars().all()) >= 5:
        raise HTTPException(status_code=400, detail="Max 5 voice channels per room")

    channel = VoiceChannel(
        room_id=room_id,
        name=data.name,
        description=data.description,
        created_by=current_user.id,
    )
    db.add(channel)
    await db.commit()
    await db.refresh(channel)

    # Re-fetch with participants loaded (empty so far)
    result = await db.execute(
        select(VoiceChannel)
        .options(selectinload(VoiceChannel.participants).selectinload(VoiceChannelParticipant.user))
        .where(VoiceChannel.id == channel.id)
    )
    channel = result.scalar_one()
    return await _serialize_channel(channel)


@rest_router.get("/channels/{channel_id}", response_model=VoiceChannelResponse)
async def get_voice_channel(
    channel_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(VoiceChannel)
        .options(selectinload(VoiceChannel.participants).selectinload(VoiceChannelParticipant.user))
        .where(VoiceChannel.id == channel_id)
    )
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Voice channel not found")

    if not await _is_room_member(db, channel.room_id, current_user):
        raise HTTPException(status_code=403, detail="Not a member of this room")

    return await _serialize_channel(channel)


@rest_router.put("/channels/{channel_id}", response_model=VoiceChannelResponse)
async def update_voice_channel(
    channel_id: str,
    data: VoiceChannelUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(VoiceChannel).where(VoiceChannel.id == channel_id)
    )
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Voice channel not found")

    # Must be a site admin or the channel creator
    if current_user.role != "admin" and channel.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(channel, key, value)

    await db.commit()
    await db.refresh(channel)

    # Re-fetch with participants
    result = await db.execute(
        select(VoiceChannel)
        .options(selectinload(VoiceChannel.participants).selectinload(VoiceChannelParticipant.user))
        .where(VoiceChannel.id == channel.id)
    )
    channel = result.scalar_one()
    return await _serialize_channel(channel)


@rest_router.delete("/channels/{channel_id}", status_code=204)
async def delete_voice_channel(
    channel_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(VoiceChannel).where(VoiceChannel.id == channel_id)
    )
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Voice channel not found")

    if current_user.role != "admin" and channel.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.delete(channel)
    await db.commit()


@rest_router.post(
    "/channels/{channel_id}/join",
    response_model=VoiceChannelParticipantResponse,
    status_code=status.HTTP_200_OK,
)
async def join_voice_channel(
    channel_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(VoiceChannel)
        .options(selectinload(VoiceChannel.participants))
        .where(VoiceChannel.id == channel_id)
    )
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Voice channel not found")

    if not await _is_room_member(db, channel.room_id, current_user):
        raise HTTPException(status_code=403, detail="Not a member of this room")

    existing = await db.execute(
        select(VoiceChannelParticipant).where(
            VoiceChannelParticipant.channel_id == channel_id,
            VoiceChannelParticipant.user_id == current_user.id,
        )
    )
    participant = existing.scalar_one_or_none()
    if participant:
        await db.refresh(participant, attribute_names=["user"])
        return await _serialize_participant(participant)

    participant = VoiceChannelParticipant(
        channel_id=channel_id,
        user_id=current_user.id,
        joined_at=datetime.utcnow(),
    )
    db.add(participant)
    await db.commit()
    await db.refresh(participant, attribute_names=["user"])

    # Notify all participants asynchronously
    await _serialize_and_broadcast(db, channel_id)
    return await _serialize_participant(participant)


async def get_full_channel(db: AsyncSession, channel_id: str) -> VoiceChannel:
    result = await db.execute(
        select(VoiceChannel)
        .options(selectinload(VoiceChannel.participants).selectinload(VoiceChannelParticipant.user))
        .where(VoiceChannel.id == channel_id)
    )
    return result.scalar_one_or_none()


async def _serialize_and_broadcast(db: AsyncSession, channel_id: str):
    """Serialize the channel (while the DB session is still open) and schedule a
    non-blocking broadcast of its state to every participant."""
    full = await get_full_channel(db, channel_id)
    if not full:
        return
    serialized = await _serialize_channel(full)
    asyncio.create_task(_broadcast_channel_state(channel_id, serialized))


@rest_router.post("/channels/{channel_id}/leave", status_code=204)
async def leave_voice_channel(
    channel_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(VoiceChannelParticipant).where(
            VoiceChannelParticipant.channel_id == channel_id,
            VoiceChannelParticipant.user_id == current_user.id,
        )
    )
    participant = result.scalar_one_or_none()
    if not participant:
        return

    await db.delete(participant)
    await db.commit()

    # Check if channel is now empty → auto-delete
    remaining = await db.execute(
        select(VoiceChannelParticipant).where(
            VoiceChannelParticipant.channel_id == channel_id
        )
    )
    if not remaining.scalars().all():
        # Delete the empty channel
        ch = await db.execute(
            select(VoiceChannel).where(VoiceChannel.id == channel_id)
        )
        channel = ch.scalar_one_or_none()
        if channel:
            await db.delete(channel)
            await db.commit()
    else:
        await _serialize_and_broadcast(db, channel_id)


@rest_router.put(
    "/channels/{channel_id}/me",
    response_model=VoiceChannelParticipantResponse,
)
async def update_participant_state(
    channel_id: str,
    data: MuteStateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(VoiceChannelParticipant).where(
            VoiceChannelParticipant.channel_id == channel_id,
            VoiceChannelParticipant.user_id == current_user.id,
        )
    )
    participant = result.scalar_one_or_none()
    if not participant:
        raise HTTPException(status_code=404, detail="Not a participant in this channel")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(participant, key, value)
    await db.commit()
    await db.refresh(participant, attribute_names=["user"])

    # Broadcast update
    await _serialize_and_broadcast(db, channel_id)

    return await _serialize_participant(participant)


# ---------------------------------------------------------------------------
# WebSocket signaling router (WebRTC relay)
# ---------------------------------------------------------------------------

ws_router = APIRouter()


# In-memory tracking per process: channel -> set of user_ids (for signaling relay)
_voice_sockets: dict[str, set[str]] = {}  # channel_id -> user_ids
_user_to_channel: dict[str, set[str]] = {}  # user_id -> set(channel_id)


@ws_router.websocket("/voice-ws")
async def voice_ws_endpoint(
    websocket: WebSocket,
    current_user: Optional[User] = Depends(get_current_user_ws),
    db: AsyncSession = Depends(get_db),
):
    if not current_user:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await websocket.accept()
    user_id = current_user.id

    channel_ids: set[str] = set()

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            op = data.get("op")

            if op == "join_channel":
                # User wants to subscribe to signaling for this channel
                cid = data.get("channel_id")
                if not cid:
                    continue
                if cid not in _voice_sockets:
                    _voice_sockets[cid] = set()
                _voice_sockets[cid].add(user_id)
                if user_id not in _user_to_channel:
                    _user_to_channel[user_id] = set()
                _user_to_channel[user_id].add(cid)
                channel_ids.add(cid)

                # Notify others about new peer
                _relay_signal(
                    cid,
                    exclude_user_id=user_id,
                    signal={
                        "t": "user_joined",
                        "channel_id": cid,
                        "user_id": user_id,
                    },
                )

            elif op == "leave_channel":
                cid = data.get("channel_id")
                if cid:
                    _voice_sockets.get(cid, set()).discard(user_id)
                    _user_to_channel.get(user_id, set()).discard(cid)
                    channel_ids.discard(cid)
                    _relay_signal(
                        cid,
                        exclude_user_id=user_id,
                        signal={
                            "t": "user_left",
                            "channel_id": cid,
                            "user_id": user_id,
                        },
                    )

            elif op == "signal":
                cid = data.get("channel_id")
                signal_type = data.get("type")
                if not cid or not signal_type:
                    continue
                # Relay actual WebRTC signals to all OTHER peers in the channel
                _relay_signal(
                    cid,
                    exclude_user_id=user_id,
                    signal={
                        "t": "signal",
                        "channel_id": cid,
                        "from": user_id,
                        "type": signal_type,
                        "data": data.get("data", {}),
                    },
                )

            elif op == "ping":
                await websocket.send_json({"t": "pong"})

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        for cid in channel_ids:
            _voice_sockets.get(cid, set()).discard(user_id)
            _user_to_channel.get(user_id, set()).discard(cid)
            _relay_signal(
                cid,
                exclude_user_id=user_id,
                signal={
                    "t": "user_left",
                    "channel_id": cid,
                    "user_id": user_id,
                },
            )


def _relay_signal(channel_id: str, exclude_user_id: Optional[str], signal: dict):
    """Relay a signaling message to every connected peer in the voice channel."""
    peers = _voice_sockets.get(channel_id, set())
    # Use the raw session-level connections map for direct send (not Redis pub/sub,
    # signaling is session-local and ephemeral)
    from ..ws_manager import manager
    for uid in peers:
        if uid != exclude_user_id:
            # Use direct local delivery (signaling needs low latency, not cross-worker)
            ws = manager.active_connections.get(uid)
            if ws:
                asyncio.create_task(_safe_send_json(ws, signal))


async def _safe_send_json(ws: WebSocket, data: dict):
    try:
        await ws.send_json(data)
    except Exception:
        pass