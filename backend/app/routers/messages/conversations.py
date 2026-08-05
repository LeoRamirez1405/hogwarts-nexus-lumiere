"""Conversation-list endpoint and per-conversation preferences (hide, mute, pin)."""

from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.chat_room import ChatRoomMember, UserConversationPreference
from ...models.user import User
from ...schemas.message import ConversationResponse, MuteRequest
from .deps import (
    _get_cached_conversations,
    _invalidate_conversations_cache,
    _set_cached_conversations,
)
from .serializers import build_conversations

router = APIRouter()


@router.get("/conversations", response_model=List[ConversationResponse])
async def get_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Try cache first
    cached = await _get_cached_conversations(current_user.id)
    if cached is not None:
        return cached

    # Build and cache
    conversations = await build_conversations(db, current_user)
    await _set_cached_conversations(current_user.id, conversations)
    return conversations


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
    await _invalidate_conversations_cache(current_user.id)
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
        await _invalidate_conversations_cache(current_user.id)

    return {"ok": True}


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
        elif duration == "7d":
            muted_until = datetime.utcnow() + timedelta(days=7)
        elif duration == "forever":
            muted_until = datetime(2099, 12, 31, 23, 59, 59)
        else:
            raise HTTPException(status_code=400, detail="Invalid duration. Use: 8h, 24h, 7d, forever, off")
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
    await _invalidate_conversations_cache(current_user.id)
    return {"ok": True, "muted_until": muted_until.isoformat() if muted_until else None}


@router.put("/conversations/{conv_type}/{conv_id}/pin")
async def pin_conversation(
    conv_type: str,
    conv_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pin a conversation to the top of the list."""
    if conv_type not in ("dm", "room"):
        raise HTTPException(status_code=400, detail="conv_type must be 'dm' or 'room'")

    if conv_type == "room":
        member = (
            await db.execute(
                select(ChatRoomMember).where(
                    and_(ChatRoomMember.room_id == conv_id, ChatRoomMember.user_id == current_user.id)
                )
            )
        ).scalar_one_or_none()
        if not member:
            raise HTTPException(status_code=403, detail="Not a member of this room")
    else:
        other = await db.execute(select(User).where(User.id == conv_id))
        other = other.scalar_one_or_none()
        if not other:
            raise HTTPException(status_code=404, detail="User not found")

    pref = (
        await db.execute(
            select(UserConversationPreference).where(
                and_(
                    UserConversationPreference.user_id == current_user.id,
                    UserConversationPreference.conversation_type == conv_type,
                    UserConversationPreference.conversation_id == conv_id,
                )
            )
        )
    ).scalar_one_or_none()

    if pref:
        pref.pinned_at = datetime.utcnow()
    else:
        pref = UserConversationPreference(
            user_id=current_user.id,
            conversation_type=conv_type,
            conversation_id=conv_id,
            pinned_at=datetime.utcnow(),
        )
        db.add(pref)

    await db.commit()
    await _invalidate_conversations_cache(current_user.id)
    return {"ok": True, "pinned_at": pref.pinned_at.isoformat() if pref.pinned_at else None}


@router.delete("/conversations/{conv_type}/{conv_id}/pin")
async def unpin_conversation(
    conv_type: str,
    conv_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Unpin a conversation."""
    if conv_type not in ("dm", "room"):
        raise HTTPException(status_code=400, detail="conv_type must be 'dm' or 'room'")

    pref = (
        await db.execute(
            select(UserConversationPreference).where(
                and_(
                    UserConversationPreference.user_id == current_user.id,
                    UserConversationPreference.conversation_type == conv_type,
                    UserConversationPreference.conversation_id == conv_id,
                )
            )
        )
    ).scalar_one_or_none()

    if pref:
        pref.pinned_at = None
        await db.commit()
        await _invalidate_conversations_cache(current_user.id)

    return {"ok": True}
