from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from ..database import get_db
from ..models.message import Message
from ..models.user import User
from ..schemas.message import MessageCreate, MessageResponse, ConversationResponse
from ..schemas.user import UserResponse
from ..middleware.auth import get_current_user

router = APIRouter()


@router.get("/conversations", response_model=List[ConversationResponse])
async def get_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Message).where(
            or_(
                Message.sender_id == current_user.id,
                Message.receiver_id == current_user.id,
            )
        ).order_by(Message.created_at.desc())
    )
    messages = result.scalars().all()

    conversations = {}
    for msg in messages:
        other_id = msg.receiver_id if msg.sender_id == current_user.id else msg.sender_id

        if other_id not in conversations:
            other_result = await db.execute(select(User).where(User.id == other_id))
            other_user = other_result.scalar_one_or_none()
            if other_user:
                conversations[other_id] = ConversationResponse(
                    user=UserResponse.model_validate(other_user),
                    last_message=MessageResponse.model_validate(msg),
                    unread_count=0,
                )

        if msg.receiver_id == current_user.id and not msg.read:
            conversations[other_id].unread_count += 1

    return list(conversations.values())


@router.get("/{user_id}", response_model=List[MessageResponse])
async def get_messages(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Message).where(
            or_(
                (Message.sender_id == current_user.id) & (Message.receiver_id == user_id),
                (Message.sender_id == user_id) & (Message.receiver_id == current_user.id),
            )
        ).order_by(Message.created_at.asc())
    )
    messages = result.scalars().all()

    for msg in messages:
        if msg.receiver_id == current_user.id and not msg.read:
            msg.read = True

    await db.commit()
    return messages


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

    receiver_result = await db.execute(
        select(User).where(User.id == message_data.receiver_id)
    )
    if not receiver_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Receiver not found")

    message = Message(
        sender_id=current_user.id,
        receiver_id=message_data.receiver_id,
        body=message_data.body,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message
