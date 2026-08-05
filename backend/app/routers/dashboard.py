from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..database import get_db
from ..models.user import User
from ..models.product import Product
from ..models.article import Article
from ..models.creature import Creature
from ..models.transaction import Transaction
from ..middleware.auth import get_current_user

router = APIRouter()


@router.get("/")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    if current_user.role == "admin":
        total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
        total_products = (await db.execute(select(func.count(Product.id)))).scalar() or 0
        total_articles = (await db.execute(select(func.count(Article.id)))).scalar() or 0
        total_creatures = (await db.execute(select(func.count(Creature.id)))).scalar() or 0

        zerines_result = await db.execute(select(func.coalesce(func.sum(User.zerines), 0)))
        total_zerines = zerines_result.scalar()

        house_points_rows = (
            await db.execute(
                select(User.house, func.coalesce(func.sum(User.house_points), 0))
                .where(User.house.isnot(None))
                .group_by(User.house)
            )
        ).all()
        house_points = {row[0]: row[1] for row in house_points_rows}

        recent_result = await db.execute(
            select(Transaction).order_by(Transaction.created_at.desc()).limit(10)
        )
        recent_transactions = recent_result.scalars().all()

        return {
            "role": "admin",
            "total_users": total_users,
            "total_products": total_products,
            "total_articles": total_articles,
            "total_creatures": total_creatures,
            "total_zerines_in_circulation": total_zerines,
            "house_points": house_points,
            "recent_transactions": [
                {
                    "id": t.id,
                    "sender_id": t.sender_id,
                    "receiver_id": t.receiver_id,
                    "amount": t.amount,
                    "type": t.type,
                    "description": t.description,
                    "status": t.status,
                    "created_at": t.created_at.isoformat(),
                }
                for t in recent_transactions
            ],
        }

    user_result = await db.execute(
        select(Transaction)
        .where(
            (Transaction.sender_id == current_user.id)
            | (Transaction.receiver_id == current_user.id)
        )
        .order_by(Transaction.created_at.desc())
    )
    recent_transactions = user_result.scalars().all()

    from ..models.user_creature import UserCreature
    creatures_result = await db.execute(
        select(func.count(UserCreature.id)).where(UserCreature.user_id == current_user.id)
    )
    my_creatures_count = creatures_result.scalar() or 0

    from ..models.post import Post, PostLike
    posts_result = await db.execute(
        select(func.count(Post.id)).where(Post.author_id == current_user.id)
    )
    my_posts_count = posts_result.scalar() or 0

    likes_result = await db.execute(
        select(func.count(PostLike.user_id))
        .join(Post, Post.id == PostLike.post_id)
        .where(Post.author_id == current_user.id)
    )
    total_likes_received = likes_result.scalar() or 0

    from ..models.message import Message
    unread_result = await db.execute(
        select(func.count(Message.id)).where(
            Message.receiver_id == current_user.id,
            Message.read.is_(False),
        )
    )
    unread_messages = unread_result.scalar() or 0

    return {
        "role": "user",
        "zerines": current_user.zerines,
        "my_creatures": my_creatures_count,
        "my_posts": my_posts_count,
        "total_likes_received": total_likes_received,
        "unread_messages": unread_messages,
        "recent_transactions": [
            {
                "id": t.id,
                "sender_id": t.sender_id,
                "receiver_id": t.receiver_id,
                "amount": t.amount,
                "type": t.type,
                "description": t.description,
                "status": t.status,
                "created_at": t.created_at.isoformat(),
            }
            for t in recent_transactions[:10]
        ],
    }
