import json
import base64
from typing import Tuple

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...models.chat_room import ChatRoom, ChatRoomMember
from ...models.e2e_encryption import EncryptedMessage
from ...models.message import Message, Poll, PollOption
from ...models.user import User
from ...notifications_service import notify, resolve_mentions, N
from ...schemas.message import ForwardMessageRequest, MessageCreate
from ...routers.messages.deps import _PIN_OPTS
from .conversation_prefs import (
    _update_conversation_preferences,
    is_conversation_muted,
    update_conversation_preferences_after_delete,
    update_conversation_preview_after_edit,
)
from ...utils.dates import utcnow


async def create_mention_notifications(
    db: AsyncSession,
    sender: User,
    body: str,
    room_name: str,
    room_id: str,
    message_id: str,
):
    for mentioned_user in await resolve_mentions(
        db, body, room_id=room_id, sender_id=sender.id
    ):
        if mentioned_user.id == sender.id:
            continue
        if await is_conversation_muted(db, mentioned_user.id, "room", room_id):
            continue
        await notify(
            db,
            user_id=mentioned_user.id,
            type=N.MENTION,
            title=f"@{sender.name} te mencionó en {room_name}",
            body=body[:200],
            related_id=f"{room_id}:{message_id}",
            actor_id=sender.id,
        )


async def validate_and_create_message(
    db: AsyncSession,
    message_data: MessageCreate,
    current_user: User,
) -> Tuple[Message, User]:
    if message_data.receiver_id == current_user.id:
        raise ValueError("Cannot send message to yourself")

    receiver = None
    if message_data.receiver_id:
        receiver_result = await db.execute(
            select(User).where(User.id == message_data.receiver_id)
        )
        receiver = receiver_result.scalar_one_or_none()
        if not receiver:
            raise ValueError("Receiver not found")

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
            raise ValueError("Not a member of this chat room")
        room_result = await db.execute(
            select(ChatRoom).where(ChatRoom.id == message_data.room_id)
        )
        room = room_result.scalar_one_or_none()
        if room and room.closed and current_user.role != "admin":
            raise ValueError("This room is closed by an administrator")

    metadata_json = None
    if message_data.metadata:
        metadata_json = json.dumps(message_data.metadata)

    is_e2e = message_data.e2e_encrypted

    message = Message(
        sender_id=current_user.id,
        receiver_id=message_data.receiver_id,
        room_id=message_data.room_id,
        reply_to_id=message_data.reply_to_id,
        kind=message_data.kind or "text",
        body=message_data.body,
        attachment_url=message_data.attachment_url,
        attachment_type=message_data.attachment_type,
        attachment_name=message_data.attachment_name,
        metadata_json=metadata_json,
        disappear_at=message_data.disappear_at,
        e2e_encrypted=is_e2e,
    )

    db.add(message)
    await db.flush()

    if is_e2e and message_data.e2e_ciphertext:
        encrypted_msg = EncryptedMessage(
            message_id=message.id,
            sender_id=current_user.id,
            recipient_id=message_data.receiver_id,
            ciphertext=base64.b64decode(message_data.e2e_ciphertext),
            sender_ephemeral_public=base64.b64decode(message_data.e2e_sender_ephemeral or ""),
            counter=message_data.e2e_counter or 0,
            previous_counter=message_data.e2e_previous_counter,
            session_version=message_data.e2e_message_version or 3,
            kind=message.kind,
            has_attachment=bool(message.attachment_url),
        )
        db.add(encrypted_msg)

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

    return message, receiver


async def send_notifications_after_send(
    db: AsyncSession,
    message: Message,
    sender: User,
    receiver: User | None,
):
    notified = False

    if message.room_id and message.body and "@" in message.body:
        room_result = await db.execute(
            select(ChatRoom).where(ChatRoom.id == message.room_id)
        )
        room_obj = room_result.scalar_one_or_none()
        room_name = room_obj.name if room_obj else "el grupo"
        await create_mention_notifications(
            db, sender, message.body, room_name, message.room_id, message.id
        )
        notified = True

    if message.receiver_id and not message.room_id:
        preview = (message.body or "").strip()
        if not preview:
            preview = "Te envió un adjunto" if message.attachment_url else "Nuevo mensaje"
        if not await is_conversation_muted(db, message.receiver_id, "dm", sender.id):
            await notify(
                db,
                user_id=message.receiver_id,
                type=N.DM_MESSAGE,
                title=f"Nuevo mensaje de {sender.name}",
                body=preview[:200],
                related_id=sender.id,
                actor_id=sender.id,
            )
        notified = True

    if notified:
        await db.commit()


async def reload_message_for_response(db: AsyncSession, message: Message) -> Message:
    db.expunge(message)
    result = await db.execute(
        select(Message)
        .options(selectinload(Message.reply_to).selectinload(Message.sender))
        .where(Message.id == message.id)
    )
    return result.scalar_one()


async def edit_message_service(
    db: AsyncSession,
    message_id: str,
    body: str,
    current_user: User,
) -> Message:
    msg_result = await db.execute(select(Message).where(Message.id == message_id))
    message = msg_result.scalar_one_or_none()
    if not message:
        raise ValueError("Message not found")
    if message.sender_id != current_user.id:
        raise ValueError("Only the sender can edit this message")
    if message.kind != "text":
        raise ValueError("Only text messages can be edited")

    message.body = body
    message.edited = True
    message.edited_at = utcnow()
    await db.commit()
    await db.refresh(message)
    # Keep the inbox preview in sync when the edited message is the last one.
    await update_conversation_preview_after_edit(db, message)
    return message


async def delete_message_service(
    db: AsyncSession,
    message_id: str,
    current_user: User,
) -> Tuple[str | None, str | None]:
    msg_result = await db.execute(select(Message).where(Message.id == message_id))
    message = msg_result.scalar_one_or_none()
    if not message:
        raise ValueError("Message not found")
    if message.sender_id != current_user.id:
        raise ValueError("Only the sender can delete this message")

    room_id = message.room_id
    receiver_id = message.receiver_id
    await db.delete(message)
    await db.commit()

    if room_id:
        member_result = await db.execute(
            select(ChatRoomMember.user_id).where(ChatRoomMember.room_id == room_id)
        )
        affected = [row[0] for row in member_result.all()]
        await update_conversation_preferences_after_delete(
            db,
            conversation_type="room",
            conversation_id=room_id,
            affected_user_ids=affected,
        )
    elif receiver_id:
        await update_conversation_preferences_after_delete(
            db,
            conversation_type="dm",
            conversation_id=receiver_id,
            partner_id=current_user.id,
            affected_user_ids={current_user.id, receiver_id},
        )

    return room_id, receiver_id


async def toggle_pin_service(
    db: AsyncSession,
    message_id: str,
    current_user: User,
) -> Message:
    msg = (
        await db.execute(
            select(Message).where(Message.id == message_id).options(*_PIN_OPTS)
        )
    ).scalar_one_or_none()
    if not msg:
        raise ValueError("Message not found")

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
            raise ValueError("Not a member of this room")
    elif current_user.id not in (msg.sender_id, msg.receiver_id):
        raise ValueError("Not part of this conversation")

    msg.pinned = not bool(msg.pinned)
    await db.commit()
    await db.refresh(msg)
    return msg


async def list_room_pinned_service(
    db: AsyncSession,
    room_id: str,
    current_user: User,
) -> list[Message]:
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
        raise ValueError("Not a member of this room")

    rows = (
        await db.execute(
            select(Message)
            .where(and_(Message.room_id == room_id, Message.pinned))
            .options(*_PIN_OPTS)
            .order_by(Message.created_at.desc())
        )
    ).scalars().all()
    return rows


async def list_dm_pinned_service(
    db: AsyncSession,
    user_id: str,
    current_user: User,
) -> list[Message]:
    convo_filter = or_(
        and_(Message.sender_id == current_user.id, Message.receiver_id == user_id),
        and_(Message.sender_id == user_id, Message.receiver_id == current_user.id),
    )
    rows = (
        await db.execute(
            select(Message)
            .where(and_(convo_filter, Message.pinned))
            .options(*_PIN_OPTS)
            .order_by(Message.created_at.desc())
        )
    ).scalars().all()
    return rows


async def list_starred_service(
    db: AsyncSession,
    current_user: User,
    limit: int,
) -> list[Message]:
    room_subq = select(ChatRoomMember.room_id).where(
        ChatRoomMember.user_id == current_user.id
    )
    dm_filter = or_(
        and_(Message.sender_id == current_user.id),
        and_(Message.receiver_id == current_user.id),
    )
    rows = (
        await db.execute(
            select(Message)
            .where(and_(Message.starred, or_(dm_filter, Message.room_id.in_(room_subq))))
            .options(*_PIN_OPTS)
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    return rows


async def forward_message_service(
    db: AsyncSession,
    message_id: str,
    forward_data: ForwardMessageRequest,
    current_user: User,
) -> Message:
    original = (
        await db.execute(select(Message).where(Message.id == message_id))
    ).scalar_one_or_none()
    if not original:
        raise ValueError("Message not found")

    target_room_id = forward_data.to_room_id or None
    target_receiver_id = forward_data.to_receiver_id or None
    if not target_room_id and not target_receiver_id:
        raise ValueError("to_room_id or to_receiver_id required")

    if target_room_id:
        member = (
            await db.execute(
                select(ChatRoomMember).where(
                    and_(ChatRoomMember.room_id == target_room_id, ChatRoomMember.user_id == current_user.id)
                )
            )
        ).scalar_one_or_none()
        if not member:
            raise ValueError("Not a member of target room")

    new_msg = Message(
        sender_id=current_user.id,
        receiver_id=target_receiver_id,
        room_id=target_room_id,
        kind=original.kind,
        body=original.body,
        attachment_url=original.attachment_url,
        attachment_type=original.attachment_type,
        attachment_name=original.attachment_name,
        metadata_json=original.metadata_json,
        forwarded=True,
        forwarded_from_id=original.id,
    )
    db.add(new_msg)
    await db.flush()
    await db.commit()
    await db.refresh(new_msg)

    await _update_conversation_preferences(db, new_msg, current_user)

    db.expunge(new_msg)
    msg_result = await db.execute(
        select(Message)
        .options(selectinload(Message.reply_to).selectinload(Message.sender))
        .where(Message.id == new_msg.id)
    )
    return msg_result.scalar_one()


async def toggle_star_service(
    db: AsyncSession,
    message_id: str,
    current_user: User,
) -> dict:
    msg = (
        await db.execute(select(Message).where(Message.id == message_id))
    ).scalar_one_or_none()
    if not msg:
        raise ValueError("Message not found")

    if msg.room_id:
        member = (
            await db.execute(
                select(ChatRoomMember).where(
                    and_(ChatRoomMember.room_id == msg.room_id, ChatRoomMember.user_id == current_user.id)
                )
            )
        ).scalar_one_or_none()
        if not member:
            raise ValueError("Not a member of this room")
    elif current_user.id not in (msg.sender_id, msg.receiver_id):
        raise ValueError("Not part of this conversation")

    msg.starred = not bool(msg.starred)
    await db.commit()
    return {"ok": True, "starred": msg.starred}