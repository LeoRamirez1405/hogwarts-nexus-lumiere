from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models.forum import ForumThread, ForumThreadVote, ForumComment, ForumSubscription
from ..models.user import User
from ..models.transaction import Transaction
from ..schemas.forum import (
    ForumThreadCreate, ForumThreadResponse, ForumVoteRequest,
    ForumCommentCreate, ForumCommentResponse,
)
from ..schemas.user import UserResponse
from ..schemas.pagination import Page
from ..middleware.auth import get_current_user
from ..notifications_service import notify, resolve_mentions, N

router = APIRouter()

FORUM_COMMENT_REWARD = 5


async def _build_threads_response(
    db: AsyncSession,
    threads: List[ForumThread],
    current_user: User,
) -> List[ForumThreadResponse]:
    """Enrich a page of threads with 4 aggregate queries instead of 4 per thread."""
    if not threads:
        return []
    ids = [t.id for t in threads]

    vote_counts = {
        thread_id: int(total)
        for thread_id, total in (
            await db.execute(
                select(
                    ForumThreadVote.thread_id,
                    func.coalesce(func.sum(ForumThreadVote.value), 0),
                )
                .where(ForumThreadVote.thread_id.in_(ids))
                .group_by(ForumThreadVote.thread_id)
            )
        ).all()
    }
    my_votes = dict(
        (
            await db.execute(
                select(ForumThreadVote.thread_id, ForumThreadVote.value).where(
                    ForumThreadVote.thread_id.in_(ids),
                    ForumThreadVote.user_id == current_user.id,
                )
            )
        ).all()
    )
    comment_counts = {
        thread_id: count
        for thread_id, count in (
            await db.execute(
                select(ForumComment.thread_id, func.count())
                .where(ForumComment.thread_id.in_(ids))
                .group_by(ForumComment.thread_id)
            )
        ).all()
    }
    subscribed_ids = set(
        (
            await db.execute(
                select(ForumSubscription.thread_id).where(
                    ForumSubscription.thread_id.in_(ids),
                    ForumSubscription.user_id == current_user.id,
                )
            )
        ).scalars().all()
    )

    responses: List[ForumThreadResponse] = []
    for thread in threads:
        resp = ForumThreadResponse.model_validate(thread)
        resp.vote_count = int(vote_counts.get(thread.id, 0))
        resp.my_vote = int(my_votes.get(thread.id, 0) or 0)
        resp.comment_count = int(comment_counts.get(thread.id, 0))
        resp.subscribed = thread.id in subscribed_ids
        if thread.author:
            resp.author = UserResponse.model_validate(thread.author)
        responses.append(resp)
    return responses


async def _thread_response(
    db: AsyncSession, thread: ForumThread, current_user: User
) -> ForumThreadResponse:
    """Enrich a single thread (used by create / get / vote)."""
    return (await _build_threads_response(db, [thread], current_user))[0]


async def _get_thread(db: AsyncSession, thread_id: str) -> ForumThread:
    thread = (
        await db.execute(
            select(ForumThread)
            .options(selectinload(ForumThread.author))
            .where(ForumThread.id == thread_id)
        )
    ).scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Debate no encontrado")
    return thread


@router.get("/", response_model=Page[ForumThreadResponse])
async def list_threads(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    threads = (
        await db.execute(
            select(ForumThread)
            .options(selectinload(ForumThread.author))
            .order_by(ForumThread.created_at.desc())
            .offset(skip)
            .limit(limit + 1)
        )
    ).scalars().all()
    has_more = len(threads) > limit
    threads = threads[:limit]
    total = (
        await db.execute(select(func.count(ForumThread.id)))
    ).scalar_one()
    return Page(
        items=await _build_threads_response(db, threads, current_user),
        total=total,
        skip=skip,
        limit=limit,
        has_more=has_more,
    )


@router.post("/", response_model=ForumThreadResponse, status_code=status.HTTP_201_CREATED)
async def create_thread(
    data: ForumThreadCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    title = data.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="El título no puede estar vacío")
    thread = ForumThread(
        author_id=current_user.id,
        title=title,
        body=data.body.strip() or "Sin contenido",
        category=data.category or "General",
    )
    db.add(thread)
    await db.flush()
    # Author auto-subscribes and auto-upvotes (mirrors the old mock behavior).
    db.add(ForumThreadVote(thread_id=thread.id, user_id=current_user.id, value=1))
    db.add(ForumSubscription(thread_id=thread.id, user_id=current_user.id))
    await db.commit()
    thread = await _get_thread(db, thread.id)
    return await _thread_response(db, thread, current_user)


@router.get("/{thread_id}", response_model=ForumThreadResponse)
async def get_thread(
    thread_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    thread = await _get_thread(db, thread_id)
    return await _thread_response(db, thread, current_user)


@router.post("/{thread_id}/vote", response_model=ForumThreadResponse)
async def vote_thread(
    thread_id: str,
    data: ForumVoteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.value not in (1, -1):
        raise HTTPException(status_code=400, detail="El voto debe ser +1 o -1")
    thread = await _get_thread(db, thread_id)
    existing = (
        await db.execute(
            select(ForumThreadVote).where(
                ForumThreadVote.thread_id == thread_id,
                ForumThreadVote.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()

    if existing is None:
        db.add(
            ForumThreadVote(
                thread_id=thread_id, user_id=current_user.id, value=data.value
            )
        )
    elif existing.value == data.value:
        await db.delete(existing)  # toggle off
    else:
        existing.value = data.value  # switch direction

    await db.commit()
    thread = await _get_thread(db, thread_id)
    return await _thread_response(db, thread, current_user)


@router.delete("/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_thread(
    thread_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    thread = await _get_thread(db, thread_id)
    if thread.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Solo el autor puede eliminar el debate")
    # Remove votes / comments / subscriptions so the thread can be deleted
    # without leaving orphans or violating the FK constraints.
    await db.execute(delete(ForumThreadVote).where(ForumThreadVote.thread_id == thread_id))
    await db.execute(delete(ForumComment).where(ForumComment.thread_id == thread_id))
    await db.execute(delete(ForumSubscription).where(ForumSubscription.thread_id == thread_id))
    await db.delete(thread)
    await db.commit()


@router.get("/{thread_id}/comments", response_model=List[ForumCommentResponse])
async def list_thread_comments(
    thread_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comments = (
        await db.execute(
            select(ForumComment)
            .where(ForumComment.thread_id == thread_id)
            .order_by(ForumComment.created_at.asc())
        )
    ).scalars().all()
    out = []
    for c in comments:
        resp = ForumCommentResponse.model_validate(c)
        if c.user:
            resp.author = UserResponse.model_validate(c.user)
        out.append(resp)
    return out


@router.post(
    "/{thread_id}/comments",
    response_model=ForumCommentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_thread_comment(
    thread_id: str,
    data: ForumCommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    body = data.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="El comentario no puede estar vacío")
    thread = await _get_thread(db, thread_id)

    comment = ForumComment(thread_id=thread_id, user_id=current_user.id, body=body)
    db.add(comment)

    # Reward: 5 zerines per forum comment (as the UI promises).
    current_user.zerines += FORUM_COMMENT_REWARD
    db.add(
        Transaction(
            receiver_id=current_user.id,
            amount=FORUM_COMMENT_REWARD,
            type="reward",
            description="Recompensa por comentar en el foro",
            status="confirmed",
        )
    )

    # Commenter auto-subscribes so they follow replies too.
    already = (
        await db.execute(
            select(ForumSubscription.id).where(
                ForumSubscription.thread_id == thread_id,
                ForumSubscription.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if already is None:
        db.add(ForumSubscription(thread_id=thread_id, user_id=current_user.id))

    await db.flush()

    # Notify the thread author + every subscriber + anyone @mentioned (deduped).
    subs = (
        await db.execute(
            select(ForumSubscription.user_id).where(
                ForumSubscription.thread_id == thread_id
            )
        )
    ).scalars().all()
    recipients = {thread.author_id, *subs}
    mentioned_ids = {u.id for u in await resolve_mentions(db, body)}
    recipients |= mentioned_ids
    recipients.discard(current_user.id)

    for uid in recipients:
        ntype = N.FORUM_MENTION if uid in mentioned_ids else N.FORUM_REPLY
        title = (
            f"{current_user.name} te mencionó en {thread.title}"
            if uid in mentioned_ids
            else f"{current_user.name} respondió en {thread.title}"
        )
        await notify(
            db,
            user_id=uid,
            type=ntype,
            title=title,
            body=body[:200],
            related_id=thread_id,
            actor_id=current_user.id,
        )

    await db.commit()
    await db.refresh(comment)
    resp = ForumCommentResponse.model_validate(comment)
    resp.author = UserResponse.model_validate(current_user)
    return resp


@router.post("/{thread_id}/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe_thread(
    thread_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_thread(db, thread_id)
    existing = (
        await db.execute(
            select(ForumSubscription).where(
                ForumSubscription.thread_id == thread_id,
                ForumSubscription.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        db.add(ForumSubscription(thread_id=thread_id, user_id=current_user.id))
        await db.commit()
    return {"subscribed": True}


@router.delete("/{thread_id}/subscribe", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe_thread(
    thread_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = (
        await db.execute(
            select(ForumSubscription).where(
                ForumSubscription.thread_id == thread_id,
                ForumSubscription.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        await db.delete(existing)
        await db.commit()
