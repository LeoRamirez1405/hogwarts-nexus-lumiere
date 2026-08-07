"""Conversation preference denormalization helpers.

These maintain the ``UserConversationPreference`` denormalized row that carries
``last_message_*`` and ``unread_count`` so the conversation list can be built
with a single query instead of scanning messages.
"""

from datetime import datetime
from typing import Iterable, Optional

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...models.chat_room import ChatRoomMember, UserConversationPreference
from ...models.message import Message
from ...models.user import User
from ...routers.messages.deps import _invalidate_conversations_caches


async def is_conversation_muted(
    db: AsyncSession,
    user_id: str,
    conversation_type: str,
    conversation_id: str,
) -> bool:
    """True when the user has an active mute on this conversation."""
    now = datetime.utcnow()
    if conversation_type == "dm":
        result = await db.execute(
            select(UserConversationPreference).where(
                and_(
                    UserConversationPreference.user_id == user_id,
                    UserConversationPreference.conversation_type == "dm",
                    UserConversationPreference.conversation_id == conversation_id,
                )
            )
        )
        pref = result.scalar_one_or_none()
        return bool(pref and pref.muted_until and pref.muted_until > now)

    result = await db.execute(
        select(ChatRoomMember).where(
            and_(
                ChatRoomMember.room_id == conversation_id,
                ChatRoomMember.user_id == user_id,
            )
        )
    )
    member = result.scalar_one_or_none()
    return bool(member and member.muted_until and member.muted_until > now)


async def _update_conversation_preferences(
    db: AsyncSession, message: Message, sender: User
):
    body_preview = (message.body or "")[:200] if message.body else ""
    if not body_preview and message.attachment_url:
        body_preview = "📎 Adjunto"

    kind = message.kind or "text"
    attachment_url = message.attachment_url
    attachment_type = message.attachment_type
    attachment_name = message.attachment_name

    if message.room_id:
        conversation_type = "room"
        conversation_id = message.room_id
        member_result = await db.execute(
            select(ChatRoomMember.user_id).where(ChatRoomMember.room_id == message.room_id)
        )
        recipient_ids = [row[0] for row in member_result.all()]
    else:
        conversation_type = "dm"
        conversation_id = message.receiver_id
        recipient_ids = [message.receiver_id] if message.receiver_id else []

    affected_user_ids = {sender.id}
    affected_user_ids.update(recipient_ids)

    await _upsert_conversation_pref(
        db,
        user_id=sender.id,
        conversation_type=conversation_type,
        conversation_id=conversation_id,
        last_message_id=message.id,
        last_message_body=body_preview,
        last_message_at=message.created_at,
        last_message_sender_id=sender.id,
        last_message_kind=kind,
        last_message_attachment_url=attachment_url,
        last_message_attachment_type=attachment_type,
        last_message_attachment_name=attachment_name,
        unread_increment=0,
    )

    for recipient_id in recipient_ids:
        if recipient_id == sender.id:
            continue
        await _upsert_conversation_pref(
            db,
            user_id=recipient_id,
            conversation_type=conversation_type,
            conversation_id=conversation_id,
            last_message_id=message.id,
            last_message_body=body_preview,
            last_message_at=message.created_at,
            last_message_sender_id=sender.id,
            last_message_kind=kind,
            last_message_attachment_url=attachment_url,
            last_message_attachment_type=attachment_type,
            last_message_attachment_name=attachment_name,
            unread_increment=1,
        )

    await db.commit()

    await _invalidate_conversations_caches(list(affected_user_ids))


async def _upsert_conversation_pref(
    db: AsyncSession,
    user_id: str,
    conversation_type: str,
    conversation_id: str,
    last_message_id: str,
    last_message_body: str,
    last_message_at: datetime,
    last_message_sender_id: str,
    last_message_kind: str = "text",
    last_message_attachment_url: Optional[str] = None,
    last_message_attachment_type: Optional[str] = None,
    last_message_attachment_name: Optional[str] = None,
    unread_increment: int = 0,
):
    result = await db.execute(
        select(UserConversationPreference).where(
            and_(

                UserConversationPreference.user_id == user_id,
                UserConversationPreference.conversation_type == conversation_type,
                UserConversationPreference.conversation_id == conversation_id,
            )
        )
    )
    pref = result.scalar_one_or_none()
    if pref:
        pref.last_message_id = last_message_id
        pref.last_message_body = last_message_body
        pref.last_message_at = last_message_at
        pref.last_message_sender_id = last_message_sender_id
        pref.last_message_kind = last_message_kind
        pref.last_message_attachment_url = last_message_attachment_url
        pref.last_message_attachment_type = last_message_attachment_type
        pref.last_message_attachment_name = last_message_attachment_name
        if unread_increment > 0:
            pref.unread_count += unread_increment
    else:
        pref = UserConversationPreference(
            user_id=user_id,
            conversation_type=conversation_type,
            conversation_id=conversation_id,
            last_message_id=last_message_id,
            last_message_body=last_message_body,
            last_message_at=last_message_at,
            last_message_sender_id=last_message_sender_id,
            last_message_kind=last_message_kind,
            last_message_attachment_url=last_message_attachment_url,
            last_message_attachment_type=last_message_attachment_type,
            last_message_attachment_name=last_message_attachment_name,
            unread_count=unread_increment,
        )
        db.add(pref)


async def _conversation_latest_message(
    db: AsyncSession,
    conversation_type: str,
    conversation_id: str,
    partner_id: str,
) -> Optional[Message]:
    """Newest surviving message of a conversation (None when empty)."""
    if conversation_type == "dm":
        result = await db.execute(
            select(Message)
            .where(
                Message.room_id.is_(None),
                or_(
                    and_(
                        Message.sender_id == partner_id,
                        Message.receiver_id == conversation_id,
                    ),
                    and_(
                        Message.sender_id == conversation_id,
                        Message.receiver_id == partner_id,
                    ),
                ),
            )
            .order_by(Message.created_at.desc(), Message.id.desc())
            .limit(1)
        )
    else:
        result = await db.execute(
            select(Message)
            .where(Message.room_id == conversation_id)
            .order_by(Message.created_at.desc(), Message.id.desc())
            .limit(1)
        )
    return result.scalar_one_or_none()


async def _apply_preview(pref: UserConversationPreference, latest: Optional[Message]) -> None:
    """Point a preference row at ``latest`` (or clear it when None)."""
    if latest and latest.id != pref.last_message_id:
        body_preview = (latest.body or "")[:200] if latest.body else ""
        if not body_preview and latest.attachment_url:
            body_preview = "📎 Adjunto"
        pref.last_message_id = latest.id
        pref.last_message_body = body_preview
        pref.last_message_at = latest.created_at
        pref.last_message_sender_id = latest.sender_id
        pref.last_message_kind = latest.kind or "text"
        pref.last_message_attachment_url = latest.attachment_url
        pref.last_message_attachment_type = latest.attachment_type
        pref.last_message_attachment_name = latest.attachment_name
    elif not latest and pref.last_message_id:
        pref.last_message_id = None
        pref.last_message_body = None
        pref.last_message_at = None
        pref.last_message_sender_id = None
        pref.last_message_kind = None
        pref.last_message_attachment_url = None
        pref.last_message_attachment_type = None
        pref.last_message_attachment_name = None


async def update_conversation_preferences_after_delete(
    db: AsyncSession,
    conversation_type: str,
    conversation_id: str,
    partner_id: Optional[str] = None,
    affected_user_ids: Optional[Iterable[str]] = None,
) -> None:
    """Re-point ``last_message_*`` after a message was deleted.

    Called whenever a message disappears from a conversation (manual delete,
    WS delete, retention/expiry sweeps) so the conversation list never shows a
    deleted message as its preview. Clears the preview when no messages remain.

    For DMs, ``conversation_id``/``partner_id`` are the two user ids of the
    pair; preference rows are matched in both orientations.
    """
    if conversation_type == "dm":
        if not partner_id:
            raise ValueError("partner_id is required for dm conversations")
        latest = await _conversation_latest_message(
            db, conversation_type, conversation_id, partner_id
        )
        if affected_user_ids is None:
            affected_user_ids = {conversation_id, partner_id}
        for user_id in affected_user_ids:
            other = partner_id if user_id == conversation_id else conversation_id
            pref_result = await db.execute(
                select(UserConversationPreference).where(
                    and_(
                        UserConversationPreference.user_id == user_id,
                        UserConversationPreference.conversation_type == "dm",
                        UserConversationPreference.conversation_id == other,
                    )
                )
            )
            pref = pref_result.scalar_one_or_none()
            if pref:
                await _apply_preview(pref, latest)
    else:
        if affected_user_ids is None:
            member_result = await db.execute(
                select(ChatRoomMember.user_id).where(
                    ChatRoomMember.room_id == conversation_id
                )
            )
            affected_user_ids = [row[0] for row in member_result.all()]
        latest = await _conversation_latest_message(
            db, conversation_type, conversation_id, ""
        )
        for user_id in affected_user_ids:
            pref_result = await db.execute(
                select(UserConversationPreference).where(
                    and_(
                        UserConversationPreference.user_id == user_id,
                        UserConversationPreference.conversation_type == "room",
                        UserConversationPreference.conversation_id == conversation_id,
                    )
                )
            )
            pref = pref_result.scalar_one_or_none()
            if pref:
                await _apply_preview(pref, latest)

    await db.commit()

    await _invalidate_conversations_caches(list(affected_user_ids))