from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.user import User
from ..models.user_creature import UserCreature
from ..models.post import Post
from ..models.article import Article
from ..models.message import Message
from ..models.transaction import Transaction

LEVEL_NAMES = [
    "Aprendiz",
    "Iniciado",
    "Conjurador",
    "Encantador",
    "Hechicero",
    "Magiologo",
    "Archimago",
    "Eminencia",
    "Merlin",
    "Leyenda",
    "Ser Supremo",
]

LEVEL_THRESHOLDS = [0, 10, 30, 70, 150, 300, 550, 900, 1400, 2000, 2800]

ACTIVITY_XP = {
    "adopt_creature": 15,
    "level_up_creature": 10,
    "feed_creature": 1,
    "play_creature": 1,
    "create_post": 3,
    "create_article": 8,
    "buy_product": 5,
    "send_message": 0.5,
    "like_post": 0.5,
    "create_poll": 2,
}


async def _batch_xp(db: AsyncSession, user_ids: List[str]) -> Dict[str, int]:
    """Compute raw XP for many users with a constant handful of GROUP BY queries.

    Replaces the old O(relations) lazy-load per user: the User model now uses
    ``lazy="raise"`` so the previous 5 eager loads per user (creatures, posts,
    articles, sent_messages, transactions_sent) are impossible to trigger
    silently. Aggregates are computed server-side instead.
    """
    if not user_ids:
        return {}
    xp = {uid: 0 for uid in user_ids}

    # Creatures: base adoption XP + (level - 1) per level above 1.
    rows = (
        await db.execute(
            select(
                UserCreature.user_id,
                func.count().label("n"),
                func.coalesce(func.sum(UserCreature.level - 1), 0).label("levels"),
            )
            .where(UserCreature.user_id.in_(user_ids))
            .group_by(UserCreature.user_id)
        )
    ).all()
    for user_id, n, levels in rows:
        xp[user_id] += n * ACTIVITY_XP["adopt_creature"] + int(levels or 0) * ACTIVITY_XP["level_up_creature"]

    # Posts / articles: simple counts.
    for model, id_col, base_xp in (
        (Post, Post.author_id, ACTIVITY_XP["create_post"]),
        (Article, Article.author_id, ACTIVITY_XP["create_article"]),
    ):
        rows = (
            await db.execute(
                select(id_col, func.count()).where(id_col.in_(user_ids)).group_by(id_col)
            )
        ).all()
        for user_id, n in rows:
            xp[user_id] += n * base_xp

    # Messages: 0.5 XP each, capped at 100.
    rows = (
        await db.execute(
            select(Message.sender_id, func.count())
            .where(Message.sender_id.in_(user_ids))
            .group_by(Message.sender_id)
        )
    ).all()
    for user_id, n in rows:
        xp[user_id] += min(int(n * ACTIVITY_XP["send_message"]), 100)

    # Purchases (outgoing transactions of type "purchase").
    rows = (
        await db.execute(
            select(Transaction.sender_id, func.count())
            .where(
                Transaction.sender_id.in_(user_ids),
                Transaction.type == "purchase",
            )
            .group_by(Transaction.sender_id)
        )
    ).all()
    for user_id, n in rows:
        xp[user_id] += n * ACTIVITY_XP["buy_product"]

    return xp


def magic_level_from_xp(xp: int, last_active_at: Optional[datetime]) -> dict:
    """Turn a raw XP score into the level descriptor (pure function of XP + decay)."""
    raw_level = 0
    for i, threshold in enumerate(LEVEL_THRESHOLDS):
        if xp >= threshold:
            raw_level = i

    now = datetime.utcnow()
    if last_active_at and (now - last_active_at) > timedelta(days=7):
        decay = min(2, (now - last_active_at).days // 7)
        raw_level = max(0, raw_level - decay)

    level = max(1, min(raw_level + 1, 11))

    current_threshold = (
        LEVEL_THRESHOLDS[raw_level] if raw_level < len(LEVEL_THRESHOLDS) else LEVEL_THRESHOLDS[-1]
    )
    next_threshold = (
        LEVEL_THRESHOLDS[raw_level + 1]
        if raw_level + 1 < len(LEVEL_THRESHOLDS)
        else LEVEL_THRESHOLDS[-1]
    )

    if next_threshold > current_threshold:
        progress = (xp - current_threshold) / (next_threshold - current_threshold)
    else:
        progress = 1.0

    return {
        "level": level,
        "name": LEVEL_NAMES[raw_level] if raw_level < len(LEVEL_NAMES) else LEVEL_NAMES[-1],
        "xp": xp,
        "progress": min(progress, 1.0),
        "next_xp": next_threshold,
    }


async def get_magic_level(db: AsyncSession, user: User) -> dict:
    """Compute a single user's magic level using explicit aggregate queries."""
    xp_map = await _batch_xp(db, [user.id])
    return magic_level_from_xp(xp_map.get(user.id, 0), user.last_active_at)


async def get_magic_levels(db: AsyncSession, users: List[User]) -> Dict[str, dict]:
    """Compute magic levels for a whole page of users with ~5 queries total."""
    xp_map = await _batch_xp(db, [u.id for u in users])
    return {
        u.id: magic_level_from_xp(xp_map.get(u.id, 0), u.last_active_at)
        for u in users
    }
