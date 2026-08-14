import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.user import User
from ..models.user_creature import UserCreature
from ..models.post import Post, PostLike, PostRepost, PostComment
from ..models.article import Article, ArticleComment
from ..models.article_subscription import ArticleSubscription
from ..models.forum import ForumThread, ForumThreadVote, ForumComment, ForumSubscription
from ..models.message import Message, Poll, PollVote, MessageReaction
from ..models.reaction import Reaction
from ..models.collection import UserAlbumCompletion
from ..models.transaction import Transaction
from ..models.event import Event, EventRSVP, RSVPStatus
from ..models.chat_room import ChatRoom
from ..models.friend_request import FriendRequest
from ..models.catalog_item_favorite import CatalogItemFavorite
from ..models.roulette import RouletteSpin
from app.utils.dates import utcnow

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
    "buy_pet_item": 2,
    "create_post": 3,
    "create_article": 8,
    "create_thread": 5,
    "create_event": 10,
    "create_room": 3,
    "create_poll": 2,
    "buy_product": 5,
    "sell_creature": 3,
    "deposit": 1,
    "withdrawal": 1,
    "transfer": 1,
    "send_message": 0.5,
    "reply_message": 1,
    "like_post": 0.5,
    "repost": 2,
    "comment": 2,
    "reaction": 0.5,
    "forum_vote": 0.5,
    "poll_vote": 1,
    "subscribe": 0.5,
    "favorite_item": 0.5,
    "friend_accepted": 5,
    "rsvp_going": 2,
    "rsvp_maybe": 1,
    "daily_login": 2,
    "profile_complete": 10,
    "album_completed": 100,
}

SIMPLE_COUNT_MODELS = (
    (Post, Post.author_id, "create_post"),
    (Article, Article.author_id, "create_article"),
    (ForumThread, ForumThread.author_id, "create_thread"),
    (PostComment, PostComment.user_id, "comment"),
    (ArticleComment, ArticleComment.user_id, "comment"),
    (ForumComment, ForumComment.user_id, "comment"),
    (PostLike, PostLike.user_id, "like_post"),
    (PostRepost, PostRepost.user_id, "repost"),
    (ForumThreadVote, ForumThreadVote.user_id, "forum_vote"),
    (ForumSubscription, ForumSubscription.user_id, "subscribe"),
    (ArticleSubscription, ArticleSubscription.user_id, "subscribe"),
    (Reaction, Reaction.user_id, "reaction"),
    (MessageReaction, MessageReaction.user_id, "reaction"),
    (PollVote, PollVote.user_id, "poll_vote"),
    (CatalogItemFavorite, CatalogItemFavorite.user_id, "favorite_item"),
)


async def _batch_xp(db: AsyncSession, user_ids: List[str]) -> Dict[str, int]:
    """Compute raw XP for many users with a constant handful of GROUP BY queries.

    Every countable action (content, engagement, social, economy, pet care,
    logins, profile completion) contributes. Messages count the same in DM and
    groups; scheduled messages are excluded.
    """
    if not user_ids:
        return {}
    xp = {uid: 0 for uid in user_ids}
    uid_set = set(user_ids)

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

    # Simple per-row counts: comments, likes, reactions, votes, subscriptions...
    for model, id_col, xp_key in SIMPLE_COUNT_MODELS:
        rows = (
            await db.execute(
                select(id_col, func.count()).where(id_col.in_(user_ids)).group_by(id_col)
            )
        ).all()
        for user_id, n in rows:
            xp[user_id] += int(n * ACTIVITY_XP[xp_key])

    # Messages: 0.5 XP each (DM and groups alike), +1 XP per reply.
    # Scheduled messages never award XP.
    rows = (
        await db.execute(
            select(
                Message.sender_id,
                func.count().label("n"),
                func.count(Message.reply_to_id).label("replies"),
            )
            .where(
                Message.sender_id.in_(user_ids),
                Message.scheduled_at.is_(None),
            )
            .group_by(Message.sender_id)
        )
    ).all()
    for user_id, n, replies in rows:
        xp[user_id] += int(n * ACTIVITY_XP["send_message"])
        xp[user_id] += int((replies or 0) * ACTIVITY_XP["reply_message"])

    # Polls created (polls live on messages, so join through sender).
    rows = (
        await db.execute(
            select(Message.sender_id, func.count())
            .select_from(Poll)
            .join(Message, Message.id == Poll.message_id)
            .where(Message.sender_id.in_(user_ids))
            .group_by(Message.sender_id)
        )
    ).all()
    for user_id, n in rows:
        xp[user_id] += n * ACTIVITY_XP["create_poll"]

    # Events created and rooms created.
    for model, id_col, xp_key in (
        (Event, Event.created_by, "create_event"),
        (ChatRoom, ChatRoom.created_by, "create_room"),
    ):
        rows = (
            await db.execute(
                select(id_col, func.count()).where(id_col.in_(user_ids)).group_by(id_col)
            )
        ).all()
        for user_id, n in rows:
            xp[user_id] += n * ACTIVITY_XP[xp_key]

    # Transactions by type: purchases (buy 5 / sell a pet 3), plus 1 XP per
    # deposit (actor stored in receiver_id), withdrawal and transfer (sender).
    rows = (
        await db.execute(
            select(
                Transaction.sender_id,
                Transaction.receiver_id,
                Transaction.type,
                func.count(),
            )
            .where(
                Transaction.type.in_(("purchase", "transfer", "deposit", "withdrawal")),
                or_(
                    Transaction.sender_id.in_(user_ids),
                    Transaction.receiver_id.in_(user_ids),
                ),
            )
            .group_by(Transaction.sender_id, Transaction.receiver_id, Transaction.type)
        )
    ).all()
    for sender_id, receiver_id, ttype, n in rows:
        if ttype == "purchase":
            if sender_id in uid_set:
                xp[sender_id] += n * ACTIVITY_XP["buy_product"]
            if receiver_id and receiver_id in uid_set:
                xp[receiver_id] += n * ACTIVITY_XP["sell_creature"]
        elif ttype == "transfer":
            if sender_id in uid_set:
                xp[sender_id] += n * ACTIVITY_XP["transfer"]
        elif ttype == "withdrawal":
            if sender_id in uid_set:
                xp[sender_id] += n * ACTIVITY_XP["withdrawal"]
        elif ttype == "deposit":
            if receiver_id and receiver_id in uid_set:
                xp[receiver_id] += n * ACTIVITY_XP["deposit"]

    # Accepted friendships award XP to both users.
    rows = (
        await db.execute(
            select(FriendRequest.sender_id, FriendRequest.receiver_id)
            .where(
                FriendRequest.status == "accepted",
                or_(
                    FriendRequest.sender_id.in_(user_ids),
                    FriendRequest.receiver_id.in_(user_ids),
                ),
            )
        )
    ).all()
    for sender_id, receiver_id in rows:
        if sender_id in uid_set:
            xp[sender_id] += ACTIVITY_XP["friend_accepted"]
        if receiver_id in uid_set:
            xp[receiver_id] += ACTIVITY_XP["friend_accepted"]

    # Event RSVPs: GOING is worth more than MAYBE; NOT_GOING awards nothing.
    rows = (
        await db.execute(
            select(EventRSVP.user_id, EventRSVP.status, func.count())
            .where(EventRSVP.user_id.in_(user_ids))
            .group_by(EventRSVP.user_id, EventRSVP.status)
        )
    ).all()
    for user_id, status, n in rows:
        if status == RSVPStatus.GOING:
            xp[user_id] += n * ACTIVITY_XP["rsvp_going"]
        elif status == RSVPStatus.MAYBE:
            xp[user_id] += n * ACTIVITY_XP["rsvp_maybe"]

    # User-level counters: pet care (feeds + plays), pet items bought,
    # daily logins and one-time profile completion.
    users = (
        await db.execute(select(User).where(User.id.in_(user_ids)))
    ).scalars().all()
    for u in users:
        care = u.care_actions or 0
        xp[u.id] += care * ACTIVITY_XP["feed_creature"] + care * ACTIVITY_XP["play_creature"]
        xp[u.id] += (u.items_purchased or 0) * ACTIVITY_XP["buy_pet_item"]
        xp[u.id] += (u.daily_logins or 0) * ACTIVITY_XP["daily_login"]
        if u.profile_completed_at:
            xp[u.id] += ACTIVITY_XP["profile_complete"]

    # Albums completados: 100 XP por cada edicion cerrada (UserAlbumCompletion).
    rows = (
        await db.execute(
            select(UserAlbumCompletion.user_id, func.count())
            .where(UserAlbumCompletion.user_id.in_(user_ids))
            .group_by(UserAlbumCompletion.user_id)
        )
    ).all()
    for user_id, n in rows:
        xp[user_id] += n * ACTIVITY_XP["album_completed"]

    # Premios de XP de la ruleta: el monto viaja en result_json (prize "xp:N").
    rows = (
        await db.execute(
            select(RouletteSpin.user_id, RouletteSpin.result_json).where(
                RouletteSpin.user_id.in_(user_ids)
            )
        )
    ).all()
    for user_id, result_json in rows:
        if not result_json:
            continue
        try:
            data = json.loads(result_json)
            prize = str(data.get("prize", ""))
            if prize.startswith("xp:"):
                xp[user_id] += max(0, int(prize.split(":")[1]))
        except (ValueError, TypeError):
            continue

    return xp


def magic_level_from_xp(xp: int, last_active_at: Optional[datetime]) -> dict:
    """Turn a raw XP score into the level descriptor (pure function of XP + decay)."""
    raw_level = 0
    for i, threshold in enumerate(LEVEL_THRESHOLDS):
        if xp >= threshold:
            raw_level = i

    now = utcnow()
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
