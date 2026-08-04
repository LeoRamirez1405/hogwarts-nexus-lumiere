from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, or_, update

from ..database import get_db
from ..models.user import User
from ..models.post import Post, PostLike, PostRepost, PostComment
from ..models.article import Article, ArticleComment
from ..models.article_subscription import ArticleSubscription, Notification
from ..models.forum import ForumThread, ForumThreadVote, ForumComment, ForumSubscription
from ..models.user_creature import UserCreature
from ..models.user_pet_item import UserPetItem
from ..models.user_product import UserProduct
from ..models.transaction import Transaction
from ..models.friend_request import FriendRequest
from ..models.chat_room import ChatRoom, ChatRoomMember, UserConversationPreference
from ..models.message import Message, Poll, PollOption, PollVote, MessageReaction
from ..schemas.user import (
    UserResponse,
    UserUpdate,
    AdminCreateUser,
    AdminTitleUpdate,
    HousePointsAdjust,
    HousePoints,
    AdminResetPassword,
)
from ..schemas.pagination import Page
from ..middleware.auth import get_current_user, hash_password
from ..middleware.roles import require_role
from ..utils.magic_level import get_magic_level, get_magic_levels
from .audit_logs import log_audit

router = APIRouter()


async def _enrich_user(db: AsyncSession, user: User, level_data: dict | None = None) -> dict:
    data = {c.name: getattr(user, c.name) for c in user.__table__.columns}
    data["magic_level"] = level_data or await get_magic_level(db, user)
    return data


async def _enrich_users(db: AsyncSession, users: List[User]) -> List[dict]:
    """Enrich a page of users computing every magic level with ~5 GROUP BY queries."""
    levels = await get_magic_levels(db, users)
    return [
        {**{c.name: getattr(u, c.name) for c in u.__table__.columns}, "magic_level": levels.get(u.id)}
        for u in users
    ]


async def _delete_user_relations(db: AsyncSession, user_id: str) -> None:
    """Remove every row that references a user before deleting them.

    The ORM's ``lazy="raise"`` collection relationships plus the FK graph
    (posts, messages, transactions, notifications, chat rooms, …) make a bare
    ``db.delete(user)`` fail. Children are removed explicitly, in dependency
    order, so deletion works on both SQLite (dev) and Postgres (prod).
    """
    rooms_created = select(ChatRoom.id).where(ChatRoom.created_by == user_id)
    user_posts = select(Post.id).where(or_(Post.author_id == user_id, Post.edited_by == user_id))
    user_threads = select(ForumThread.id).where(ForumThread.author_id == user_id)
    user_articles = select(Article.id).where(Article.author_id == user_id)
    involved_messages = select(Message.id).where(or_(
        Message.sender_id == user_id,
        Message.receiver_id == user_id,
        Message.room_id.in_(rooms_created),
    ))

    # Messages (and their poll / reaction children) referencing the user or
    # living in rooms the user created.
    await db.execute(delete(MessageReaction).where(or_(
        MessageReaction.user_id == user_id,
        MessageReaction.message_id.in_(involved_messages),
    )))
    polls_of_msgs = select(Poll.id).where(Poll.message_id.in_(involved_messages))
    await db.execute(delete(PollVote).where(or_(
        PollVote.user_id == user_id,
        PollVote.poll_id.in_(polls_of_msgs),
    )))
    await db.execute(delete(PollOption).where(PollOption.poll_id.in_(select(Poll.id).where(Poll.message_id.in_(involved_messages)))))
    await db.execute(delete(Poll).where(Poll.message_id.in_(involved_messages)))
    # Null out self-references so remaining messages don't point at deleted ones.
    await db.execute(
        update(Message).where(Message.reply_to_id.in_(involved_messages)).values(reply_to_id=None)
    )
    await db.execute(delete(Message).where(Message.id.in_(involved_messages)))

    # Notifications the user received or triggered.
    await db.execute(delete(Notification).where(or_(
        Notification.user_id == user_id,
        Notification.actor_id == user_id,
    )))

    # Posts (authored or edited) and their likes / reposts / comments.
    await db.execute(delete(PostLike).where(or_(
        PostLike.user_id == user_id,
        PostLike.post_id.in_(user_posts),
    )))
    await db.execute(delete(PostRepost).where(or_(
        PostRepost.user_id == user_id,
        PostRepost.post_id.in_(user_posts),
    )))
    await db.execute(delete(PostComment).where(or_(
        PostComment.user_id == user_id,
        PostComment.post_id.in_(user_posts),
    )))
    await db.execute(delete(Post).where(Post.id.in_(user_posts)))

    # Articles (authored) and their comments / subscriptions.
    await db.execute(delete(ArticleComment).where(or_(
        ArticleComment.user_id == user_id,
        ArticleComment.article_id.in_(user_articles),
    )))
    await db.execute(delete(ArticleSubscription).where(or_(
        ArticleSubscription.user_id == user_id,
        ArticleSubscription.article_id.in_(user_articles),
    )))
    await db.execute(delete(Article).where(Article.author_id == user_id))

    # Forum threads (authored) and their votes / comments / subscriptions.
    await db.execute(delete(ForumThreadVote).where(or_(
        ForumThreadVote.user_id == user_id,
        ForumThreadVote.thread_id.in_(user_threads),
    )))
    await db.execute(delete(ForumComment).where(or_(
        ForumComment.user_id == user_id,
        ForumComment.thread_id.in_(user_threads),
    )))
    await db.execute(delete(ForumSubscription).where(or_(
        ForumSubscription.user_id == user_id,
        ForumSubscription.thread_id.in_(user_threads),
    )))
    await db.execute(delete(ForumThread).where(ForumThread.id.in_(user_threads)))

    # Pets, inventory, purchases and money.
    await db.execute(delete(UserCreature).where(UserCreature.user_id == user_id))
    await db.execute(delete(UserPetItem).where(UserPetItem.user_id == user_id))
    await db.execute(delete(UserProduct).where(UserProduct.user_id == user_id))
    await db.execute(delete(Transaction).where(or_(
        Transaction.sender_id == user_id,
        Transaction.receiver_id == user_id,
    )))

    # Social graph.
    await db.execute(delete(FriendRequest).where(or_(
        FriendRequest.sender_id == user_id,
        FriendRequest.receiver_id == user_id,
    )))

    # Chat rooms the user created (memberships + members are cleaned too),
    # plus their plain memberships and conversation preferences.
    await db.execute(delete(ChatRoomMember).where(or_(
        ChatRoomMember.user_id == user_id,
        ChatRoomMember.room_id.in_(rooms_created),
    )))
    await db.execute(delete(UserConversationPreference).where(UserConversationPreference.user_id == user_id))
    await db.execute(delete(ChatRoom).where(ChatRoom.created_by == user_id))


@router.get("/search", response_model=Page[UserResponse])
async def search_users(
    q: str = Query(""),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Busqueda de usuarios por nombre o email (server-side).

    Retorna paginacion estandar (Page[UserResponse]). Excluye al usuario
    actual. Usado por TransferTab y otras vistas que necesitan buscar
    destinatarios sin cargar toda la tabla de usuarios.

    Con `q` vacio devuelve todos los usuarios (paginados): la vista de admin
    de grupos lo usa para la carga inicial de la lista, y antes esto disparaba
    un 422 (min_length=1) que rompia la pagina.
    """
    q = q.strip()
    # Passing multiple conditions to .where() ANDs them, so we avoid and_()
    # (which was used here but never imported — a latent NameError/500 for any
    # non-empty query).
    conditions = [User.id != current_user.id]
    if q:
        pattern = f"%{q}%"
        conditions.append(
            or_(
                User.name.ilike(pattern),
                User.email.ilike(pattern),
            )
        )
    query = select(User).where(*conditions).offset(skip).limit(limit + 1)
    result = await db.execute(query)
    items = result.scalars().all()
    has_more = len(items) > limit
    items = items[:limit]
    total_result = await db.execute(select(func.count(User.id)).where(*conditions))
    total = total_result.scalar_one()
    return Page(
        items=await _enrich_users(db, items),
        total=total,
        skip=skip,
        limit=limit,
        has_more=has_more,
    )


@router.get("/", response_model=Page[UserResponse])
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    query = select(User).offset(skip).limit(limit + 1)
    count_query = select(func.count(User.id))
    result = await db.execute(query)
    items = result.scalars().all()
    has_more = len(items) > limit
    items = items[:limit]
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()
    return Page(
        items=await _enrich_users(db, items),
        total=total,
        skip=skip,
        limit=limit,
        has_more=has_more,
    )


@router.get("/houses/{house}/points", response_model=HousePoints)
async def get_house_points(
    house: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(func.coalesce(func.sum(User.house_points), 0)).where(User.house == house)
    )
    points = result.scalar()
    return HousePoints(house=house, points=points)


@router.get("/houses/all-points")
async def get_all_house_points(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User.house, func.coalesce(func.sum(User.house_points), 0))
        .where(User.house.isnot(None))
        .group_by(User.house)
    )
    return {row[0]: row[1] for row in result.all()}


@router.post("/", response_model=UserResponse)
async def create_user(
    data: AdminCreateUser,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
    request: Request = None,
):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "El email ya esta registrado")

    user = User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        house=data.house,
        role=data.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    await log_audit(
        db,
        actor=current_user,
        action="create",
        entity_type="User",
        entity_id=user.id,
        details={"name": user.name, "email": user.email, "role": user.role, "house": user.house},
        request=request,
    )
    return await _enrich_user(db, user)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return await _enrich_user(db, user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    update_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this user",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Capture old values for audit log
    old_values = {c.name: getattr(user, c.name) for c in user.__table__.columns}

    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(user, key, value)

    user.last_active_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user)

    if current_user.role == "admin" and current_user.id != user_id:
        await log_audit(
            db,
            actor=current_user,
            action="update",
            entity_type="User",
            entity_id=user.id,
            details={"old": old_values, "new": update_dict},
            request=request,
        )

    return await _enrich_user(db, user)


@router.put("/{user_id}/title", response_model=UserResponse)
async def set_user_title(
    user_id: str,
    data: AdminTitleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
    request: Request = None,
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    old_title = user.official_title
    user.official_title = data.official_title
    await db.commit()
    await db.refresh(user)

    await log_audit(
        db,
        actor=current_user,
        action="update",
        entity_type="User",
        entity_id=user.id,
        details={"field": "official_title", "old": old_title, "new": data.official_title},
        request=request,
    )

    return await _enrich_user(db, user)


@router.post("/{user_id}/house-points", response_model=UserResponse)
async def adjust_house_points(
    user_id: str,
    data: HousePointsAdjust,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
    request: Request = None,
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")

    old_points = user.house_points or 0
    user.house_points = max(0, old_points + data.points)
    await db.commit()
    await db.refresh(user)

    await log_audit(
        db,
        actor=current_user,
        action="house_points_adjust",
        entity_type="User",
        entity_id=user.id,
        details={"points_change": data.points, "old_total": old_points, "new_total": user.house_points, "reason": data.reason},
        request=request,
    )

    return await _enrich_user(db, user)


@router.post("/{user_id}/reset-password", response_model=UserResponse)
async def admin_reset_password(
    user_id: str,
    data: AdminResetPassword,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
    request: Request = None,
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")

    user.password_hash = hash_password(data.new_password)
    await db.commit()
    await db.refresh(user)

    await log_audit(
        db,
        actor=current_user,
        action="password_reset",
        entity_type="User",
        entity_id=user.id,
        details={"target_user": user.name},
        request=request,
    )

    return await _enrich_user(db, user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
    request: Request = None,
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    deleted_user_name = user.name

    await _delete_user_relations(db, user_id)
    await db.delete(user)
    await db.commit()

    await log_audit(
        db,
        actor=current_user,
        action="delete",
        entity_type="User",
        entity_id=user_id,
        details={"deleted_user_name": deleted_user_name},
        request=request,
    )
