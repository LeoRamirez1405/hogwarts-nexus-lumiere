"""Conversation preference denormalization helpers.

These maintain the ``UserConversationPreference`` denormalized row that carries
``last_message_*`` and ``unread_count`` so the conversation list can be built
with a single query instead of scanning messages.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...models.chat_room import ChatRoomMember, UserConversationPreference
from ...models.message import Message
from ...models.user import User
from ...routers.messages.deps import _invalidate_conversations_caches


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