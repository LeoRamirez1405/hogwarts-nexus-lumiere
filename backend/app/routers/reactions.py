"""Emoji reactions on posts, comments, forum threads and articles.

Toggle semantics (same as chat reactions): posting an emoji you already used
on the same target removes it and returns ``removed=True``.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..middleware.auth import get_current_user
from ..models.reaction import Reaction
from ..models.user import User
from ..schemas.reaction import (
    ReactionCreate,
    ReactionToggleResponse,
    ReactionSummaryItem,
    ReactionListResponse,
)
from ..services.reactions import (
    resolve_target_owner,
    notify_reaction,
)

router = APIRouter()

VALID_TARGETS = {
    # Posts themselves only take likes, never emoji reactions.
    "post_comment",
    "forum_thread",
    "forum_comment",
    "article",
    "article_comment",
}


@router.post(
    "/",
    response_model=ReactionToggleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def toggle_reaction(
    reaction_data: ReactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if reaction_data.target_type not in VALID_TARGETS:
        raise HTTPException(status_code=400, detail="Invalid target_type")

    owner_id, navigable_id = await resolve_target_owner(
        db, reaction_data.target_type, reaction_data.target_id
    )
    if owner_id is None:
        raise HTTPException(status_code=404, detail="Target not found")

    existing = (
        await db.execute(
            select(Reaction).where(
                Reaction.target_type == reaction_data.target_type,
                Reaction.target_id == reaction_data.target_id,
                Reaction.user_id == current_user.id,
                Reaction.emoji == reaction_data.emoji,
            )
        )
    ).scalar_one_or_none()

    if existing:
        await db.delete(existing)
        await db.commit()
        return ReactionToggleResponse(
            id=existing.id,
            target_type=existing.target_type,
            target_id=existing.target_id,
            user_id=existing.user_id,
            emoji=existing.emoji,
            created_at=existing.created_at,
            removed=True,
        )

    reaction = Reaction(
        target_type=reaction_data.target_type,
        target_id=reaction_data.target_id,
        user_id=current_user.id,
        emoji=reaction_data.emoji,
    )
    db.add(reaction)
    await db.flush()

    await notify_reaction(
        db,
        actor_name=current_user.name,
        actor_id=current_user.id,
        target_type=reaction_data.target_type,
        owner_id=owner_id,
        navigable_id=navigable_id,
        emoji=reaction_data.emoji,
    )
    await db.commit()
    await db.refresh(reaction)

    return ReactionToggleResponse(
        id=reaction.id,
        target_type=reaction.target_type,
        target_id=reaction.target_id,
        user_id=reaction.user_id,
        emoji=reaction.emoji,
        created_at=reaction.created_at,
        removed=False,
    )


@router.get("/", response_model=ReactionListResponse)
async def list_reactions(
    target_type: str = Query(...),
    target_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregated reactions for one target, grouped by emoji."""
    if target_type not in VALID_TARGETS:
        raise HTTPException(status_code=400, detail="Invalid target_type")

    result = await db.execute(
        select(Reaction)
        .where(
            Reaction.target_type == target_type,
            Reaction.target_id == target_id,
        )
        .order_by(Reaction.created_at.asc())
        .options()
    )
    reactions: List[Reaction] = list(result.scalars().all())

    total = (await db.execute(
        select(func.count(Reaction.id)).where(
            Reaction.target_type == target_type,
            Reaction.target_id == target_id,
        )
    )).scalar_one()

    grouped: dict[str, list[Reaction]] = {}
    for r in reactions:
        grouped.setdefault(r.emoji, []).append(r)

    items: list[ReactionSummaryItem] = []
    for emoji, rs in grouped.items():
        names = [r.user.name for r in rs if r.user and r.user.name][:3]
        items.append(
            ReactionSummaryItem(
                emoji=emoji,
                count=len(rs),
                reacted_by_me=any(r.user_id == current_user.id for r in rs),
                user_names=names,
            )
        )

    return ReactionListResponse(items=items, total=total)
