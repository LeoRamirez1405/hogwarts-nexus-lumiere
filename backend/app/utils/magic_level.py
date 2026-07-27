import math
from datetime import datetime, timedelta

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


def calculate_xp(user) -> int:
    creatures = user.creatures if hasattr(user, "creatures") and user.creatures else []
    creature_xp = sum(
        ACTIVITY_XP["adopt_creature"]
        + (c.level - 1) * ACTIVITY_XP["level_up_creature"]
        for c in creatures
    )

    posts = user.posts if hasattr(user, "posts") and user.posts else []
    posts_xp = len(posts) * ACTIVITY_XP["create_post"]

    articles = user.articles if hasattr(user, "articles") and user.articles else []
    articles_xp = len(articles) * ACTIVITY_XP["create_article"]

    sent_msgs = (
        user.sent_messages if hasattr(user, "sent_messages") and user.sent_messages else []
    )
    msg_xp = min(len(sent_msgs) * ACTIVITY_XP["send_message"], 100)

    sent = (
        user.transactions_sent
        if hasattr(user, "transactions_sent") and user.transactions_sent
        else []
    )
    purchases_xp = sum(
        ACTIVITY_XP["buy_product"]
        for t in sent
        if getattr(t, "type", None) == "purchase"
    )

    return int(creature_xp + posts_xp + articles_xp + msg_xp + purchases_xp)


def get_magic_level(user) -> dict:
    xp = calculate_xp(user)
    raw_level = 0
    for i, threshold in enumerate(LEVEL_THRESHOLDS):
        if xp >= threshold:
            raw_level = i

    last_active = getattr(user, "last_active_at", None)
    now = datetime.utcnow()

    if last_active and (now - last_active) > timedelta(days=7):
        decay = min(2, (now - last_active).days // 7)
        raw_level = max(0, raw_level - decay)

    level = max(1, min(raw_level + 1, 11))

    current_threshold = LEVEL_THRESHOLDS[raw_level] if raw_level < len(LEVEL_THRESHOLDS) else LEVEL_THRESHOLDS[-1]
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


def get_house_points(db, house: str) -> int:
    from sqlalchemy import select, func
    from ..models.user import User

    result = db.execute(
        select(func.coalesce(func.sum(User.zerines), 0)).where(User.house == house)
    )
    return result.scalar()
