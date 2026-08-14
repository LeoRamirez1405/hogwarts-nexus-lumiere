"""Chat history export endpoints (.txt and .json)."""

import json

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.chat_room import ChatRoom, ChatRoomMember
from ...models.message import Message
from ...models.user import User
from app.utils.dates import utcnow

router = APIRouter()


@router.get("/rooms/{room_id}/export")
async def export_room_chat(
    room_id: str,
    format: str = Query("txt", pattern="^(txt|json)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export a room's chat history as .txt or .json."""
    member = (
        await db.execute(
            select(ChatRoomMember).where(
                and_(ChatRoomMember.room_id == room_id, ChatRoomMember.user_id == current_user.id)
            )
        )
    ).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this room")

    room_result = await db.execute(select(ChatRoom).where(ChatRoom.id == room_id))
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    # Get all messages in chronological order
    stmt = (
        select(Message)
        .where(Message.room_id == room_id)
        .options(
            selectinload(Message.sender),
            selectinload(Message.reactions),
        )
        .order_by(Message.created_at.asc(), Message.id.asc())
    )
    rows = (await db.execute(stmt)).scalars().all()

    if format == "json":
        export_data = {
            "room": {
                "id": room.id,
                "name": room.name,
                "type": room.type,
                "exported_at": utcnow().isoformat(),
            },
            "messages": [
                {
                    "id": m.id,
                    "sender_id": m.sender_id,
                    "sender_name": m.sender.name if m.sender else "Unknown",
                    "body": m.body,
                    "kind": m.kind,
                    "attachment_url": m.attachment_url,
                    "attachment_name": m.attachment_name,
                    "created_at": m.created_at.isoformat(),
                    "edited": m.edited,
                    "edited_at": m.edited_at.isoformat() if m.edited_at else None,
                    "forwarded": m.forwarded,
                    "starred": m.starred,
                    "pinned": m.pinned,
                }
                for m in rows
            ],
        }
        return Response(
            content=json.dumps(export_data, ensure_ascii=False, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="chat-{room.name}-{utcnow().strftime("%Y%m%d")}.json"'},
        )

    # txt format
    lines = [
        f"Chat Export: {room.name}",
        f"Type: {room.type}",
        f"Exported: {utcnow().isoformat()}",
        f"Total messages: {len(rows)}",
        "=" * 50,
        "",
    ]
    for m in rows:
        sender = m.sender.name if m.sender else "Unknown"
        timestamp = m.created_at.strftime("%Y-%m-%d %H:%M")
        body = m.body or ""
        if m.kind == "image":
            body = "[Imagen]"
        elif m.kind == "video":
            body = "[Video]"
        elif m.kind == "document":
            body = f"[Documento: {m.attachment_name or 'archivo'}]"
        elif m.kind == "audio":
            body = "[Audio]"
        elif m.kind == "voice":
            body = "[Nota de voz]"
        elif m.kind == "sticker":
            body = "[Sticker]"
        elif m.kind == "poll":
            body = f"[Encuesta: {m.poll.question if m.poll else ''}]"
        if m.forwarded:
            body = f"(Reenviado) {body}"
        if m.starred:
            body = f"⭐ {body}"
        lines.append(f"[{timestamp}] {sender}: {body}")

    content = "\n".join(lines)
    return Response(
        content=content,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="chat-{room.name}-{utcnow().strftime("%Y%m%d")}.txt"'},
    )


@router.get("/dm/{user_id}/export")
async def export_dm_chat(
    user_id: str,
    format: str = Query("txt", pattern="^(txt|json)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export a DM conversation as .txt or .json."""
    other_user = await db.execute(select(User).where(User.id == user_id))
    other_user = other_user.scalar_one_or_none()
    if not other_user:
        raise HTTPException(status_code=404, detail="User not found")

    convo_filter = or_(
        and_(Message.sender_id == current_user.id, Message.receiver_id == user_id),
        and_(Message.sender_id == user_id, Message.receiver_id == current_user.id),
    )

    stmt = (
        select(Message)
        .where(convo_filter)
        .options(
            selectinload(Message.sender),
            selectinload(Message.receiver),
            selectinload(Message.reactions),
        )
        .order_by(Message.created_at.asc(), Message.id.asc())
    )
    rows = (await db.execute(stmt)).scalars().all()

    if format == "json":
        export_data = {
            "conversation": {
                "type": "direct",
                "participants": [
                    {"id": current_user.id, "name": current_user.name},
                    {"id": other_user.id, "name": other_user.name},
                ],
                "exported_at": utcnow().isoformat(),
            },
            "messages": [
                {
                    "id": m.id,
                    "sender_id": m.sender_id,
                    "sender_name": m.sender.name if m.sender else "Unknown",
                    "body": m.body,
                    "kind": m.kind,
                    "attachment_url": m.attachment_url,
                    "attachment_name": m.attachment_name,
                    "created_at": m.created_at.isoformat(),
                    "edited": m.edited,
                    "edited_at": m.edited_at.isoformat() if m.edited_at else None,
                    "forwarded": m.forwarded,
                    "starred": m.starred,
                    "pinned": m.pinned,
                }
                for m in rows
            ],
        }
        return Response(
            content=json.dumps(export_data, ensure_ascii=False, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="chat-dm-{other_user.name}-{utcnow().strftime("%Y%m%d")}.json"'},
        )

    lines = [
        f"Chat Export: DM con {other_user.name}",
        f"Exported: {utcnow().isoformat()}",
        f"Total messages: {len(rows)}",
        "=" * 50,
        "",
    ]
    for m in rows:
        sender = m.sender.name if m.sender else "Unknown"
        timestamp = m.created_at.strftime("%Y-%m-%d %H:%M")
        body = m.body or ""
        if m.kind == "image":
            body = "[Imagen]"
        elif m.kind == "video":
            body = "[Video]"
        elif m.kind == "document":
            body = f"[Documento: {m.attachment_name or 'archivo'}]"
        elif m.kind == "audio":
            body = "[Audio]"
        elif m.kind == "voice":
            body = "[Nota de voz]"
        elif m.kind == "sticker":
            body = "[Sticker]"
        elif m.kind == "poll":
            body = f"[Encuesta: {m.poll.question if m.poll else ''}]"
        if m.forwarded:
            body = f"(Reenviado) {body}"
        if m.starred:
            body = f"⭐ {body}"
        lines.append(f"[{timestamp}] {sender}: {body}")

    content = "\n".join(lines)
    return Response(
        content=content,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="chat-dm-{other_user.name}-{utcnow().strftime("%Y%m%d")}.txt"'},
    )
