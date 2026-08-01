"""Message interactions: poll voting and emoji reactions."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.message import Message, MessageReaction, Poll, PollOption, PollVote
from ...models.user import User
from ...schemas.message import MessageReactionResponse, PollVoteRequest, ReactionCreate

router = APIRouter()


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
