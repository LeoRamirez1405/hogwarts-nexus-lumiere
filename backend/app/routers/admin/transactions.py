"""Admin-only transaction routes (prefix /admin/transactions)."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from ...database import get_db
from ...middleware.roles import require_role
from ...models.transaction import Transaction
from ...models.user import User
from ...schemas.pagination import Page
from ...schemas.transaction import TransactionResponse

router = APIRouter(prefix="/admin/transactions", tags=["admin-transactions"])


@router.get("/", response_model=Page[TransactionResponse])
async def list_all_transactions_admin(
    type: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    query = (
        select(Transaction)
        .options(
            joinedload(Transaction.sender),
            joinedload(Transaction.receiver),
        )
    )
    count_query = select(func.count(Transaction.id))
    if type:
        query = query.where(Transaction.type == type)
        count_query = count_query.where(Transaction.type == type)
    if user_id:
        query = query.where(
            (Transaction.sender_id == user_id) | (Transaction.receiver_id == user_id)
        )
        count_query = count_query.where(
            (Transaction.sender_id == user_id) | (Transaction.receiver_id == user_id)
        )
    if date_from:
        query = query.where(Transaction.created_at >= date_from)
        count_query = count_query.where(Transaction.created_at >= date_from)
    if date_to:
        query = query.where(Transaction.created_at <= date_to)
        count_query = count_query.where(Transaction.created_at <= date_to)
    if search:
        search_term = f"%{search}%"
        user_filter = or_(
            User.name.ilike(search_term),
            User.email.ilike(search_term),
        )
        search_filter = or_(
            Transaction.description.ilike(search_term),
            Transaction.sender.has(user_filter),
            Transaction.receiver.has(user_filter),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
    query = (
        query.order_by(Transaction.created_at.desc())
        .offset(skip)
        .limit(limit + 1)
    )
    result = await db.execute(query)
    items = result.scalars().all()
    has_more = len(items) > limit
    items = items[:limit]
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()
    return Page(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
        has_more=has_more,
    )
