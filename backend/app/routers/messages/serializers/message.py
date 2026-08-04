"""Message serialization: ``serialize_message``, ``serialize_poll``,
``serialize_room`` and ``_preview_message``."""

import json

from sqlalchemy.ext.asyncio import AsyncSession

from ....models.chat_room import ChatRoom
from ....models.message import Message, Poll
from ....schemas.message import (
    ChatRoomMemberResponse,
    ChatRoomResponse,
    MessageReactionResponse,
    MessageResponse,
    PollOptionResponse,
    PollResponse,
)

MAX_REPLY_DEPTH = 1


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
    db: AsyncSession, msg: Message, current_user_id: str,
    expand_sender: bool = False, expand_receiver: bool = False,
    expand_reactions: bool = False, expand_reply_to: bool = False,
    reply_depth: int = 0,
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
    if (
        expand_reply_to
        and msg.reply_to_id
        and msg.reply_to
        and reply_depth < MAX_REPLY_DEPTH
    ):
        reply_to_data = await serialize_message(
            db, msg.reply_to, current_user_id,
            expand_sender=expand_sender, expand_receiver=expand_receiver,
            expand_reactions=expand_reactions,
            reply_depth=reply_depth + 1,
        )

    reactions_out = []
    if expand_reactions:
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

    sender_data = msg.sender if expand_sender else None
    receiver_data = msg.receiver if expand_receiver else None

    return MessageResponse(
        id=msg.id,
        sender_id=msg.sender_id,
        receiver_id=msg.receiver_id,
        room_id=msg.room_id,
        reply_to_id=msg.reply_to_id,
        forwarded_from_id=msg.forwarded_from_id,
        forwarded=bool(msg.forwarded),
        starred=bool(msg.starred),
        disappear_at=msg.disappear_at,
        scheduled_at=msg.scheduled_at,
        kind=msg.kind,
        body=msg.body,
        attachment_url=msg.attachment_url,
        attachment_type=msg.attachment_type,
        attachment_name=msg.attachment_name,
        metadata=metadata,
        read=msg.read,
        pinned=bool(msg.pinned),
        edited=bool(msg.edited),
        edited_at=msg.edited_at,
        created_at=msg.created_at,
        sender=sender_data,
        receiver=receiver_data,
        room=None,
        poll=poll_data,
        reply_to=reply_to_data,
        reactions=reactions_out,
        e2e_encrypted=bool(getattr(msg, "e2e_encrypted", False)),
        e2e_ciphertext=None,
        e2e_sender_ephemeral=None,
        e2e_counter=None,
        e2e_previous_counter=None,
        e2e_message_version=None,
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
                pending=bool(getattr(m, "pending", False)),
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
        join_approval=bool(getattr(room, "join_approval", False)),
        created_by=room.created_by,
        created_at=room.created_at,
        members=members_out,
    )


def _preview_message(msg: Message, sender) -> MessageResponse:
    return MessageResponse(
        id=msg.id,
        sender_id=msg.sender_id,
        receiver_id=msg.receiver_id,
        room_id=msg.room_id,
        reply_to_id=None,
        kind=msg.kind or "text",
        body=msg.body,
        attachment_url=msg.attachment_url,
        attachment_type=msg.attachment_type,
        attachment_name=msg.attachment_name,
        metadata=None,
        read=True,
        pinned=False,
        created_at=msg.created_at,
        sender=sender,
        receiver=None,
        room=None,
        poll=None,
        reply_to=None,
        reactions=[],
        e2e_encrypted=bool(getattr(msg, "e2e_encrypted", False)),
    )