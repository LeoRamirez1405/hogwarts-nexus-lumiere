from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....middleware.auth import get_current_user
from ....models.user import User
from ....schemas.message import MessagePage, MessageResponse
from ....services.messages.message_fetch_service import get_messages_service, get_messages_since_service
from ..serializers import serialize_message

router = APIRouter()


@router.get("/{user_id}", response_model=MessagePage)
async def get_messages(
    user_id: str,
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

    result = await get_messages_service(
        db, user_id, current_user, limit, before,
        expand_sender, expand_receiver, expand_reactions, expand_reply_to,
    )

    out = [
        await serialize_message(
            db, m, current_user.id,
            expand_sender=expand_sender, expand_receiver=expand_receiver,
            expand_reactions=expand_reactions, expand_reply_to=expand_reply_to,
        )
        for m in result["rows"]
    ]
    out.reverse()
    return MessagePage(
        messages=out,
        has_more=result["has_more"],
        first_unread_id=result["first_unread_id"],
        unread_count=result["unread_count"],
    )


@router.get("/since/{last_id}", response_model=List[MessageResponse])
async def get_messages_since(
    last_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=200),
    expand: str = Query("", description="Comma-separated list of relations to expand: sender,receiver,reactions,reply_to"),
):
    expand_sender = "sender" in expand
    expand_receiver = "receiver" in expand
    expand_reactions = "reactions" in expand
    expand_reply_to = "reply_to" in expand

    try:
        rows = await get_messages_since_service(
            db, last_id, current_user, limit,
            expand_sender, expand_receiver, expand_reactions, expand_reply_to,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    return [
        await serialize_message(
            db, m, current_user.id,
            expand_sender=expand_sender, expand_receiver=expand_receiver,
            expand_reactions=expand_reactions, expand_reply_to=expand_reply_to,
        )
        for m in rows
    ]