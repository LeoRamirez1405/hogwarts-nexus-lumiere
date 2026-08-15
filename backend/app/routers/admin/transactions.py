"""Admin-only transaction routes (prefix /admin/transactions)."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from ...database import get_db
from ...middleware.roles import require_role
from ...models.transaction import Transaction
from ...models.user import User
from ...notifications_service import notify, N
from ...schemas.pagination import Page
from ...schemas.transaction import AdminTransactionCreate, TransactionResponse

router = APIRouter(prefix="/admin/transactions", tags=["admin-transactions"])


async def _validate_target_users(db: AsyncSession, user_ids: list[str]) -> list[User]:
    if not user_ids:
        raise HTTPException(status_code=400, detail="Selecciona al menos un usuario")
    users = (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
    if len(users) != len(user_ids):
        raise HTTPException(status_code=404, detail="Uno o más usuarios no existen")
    return list(users)


@router.post("/deposit", response_model=list[TransactionResponse], status_code=status.HTTP_201_CREATED)
async def admin_deposit(
    data: AdminTransactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="El monto debe ser positivo")
    users = await _validate_target_users(db, data.user_ids)

    description = data.description
    body = f"{current_user.name} depositó {data.amount} zerines en tu cuenta. Motivo: {data.description}"
    transactions = []
    for user in users:
        user.zerines += data.amount
        transaction = Transaction(
            receiver_id=user.id,
            amount=data.amount,
            type="deposit",
            description=description,
            status="confirmed",
        )
        db.add(transaction)
        transactions.append(transaction)
        await notify(
            db,
            user_id=user.id,
            type=N.ZERINES_RECEIVED,
            title=f"Recibiste {data.amount} zerines",
            body=body,
            related_id=transaction.id,
            actor_id=current_user.id,
        )
    await db.commit()
    for transaction in transactions:
        await db.refresh(transaction)
    return transactions


@router.post("/withdraw", response_model=list[TransactionResponse], status_code=status.HTTP_201_CREATED)
async def admin_withdraw(
    data: AdminTransactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="El monto debe ser positivo")
    users = await _validate_target_users(db, data.user_ids)

    short = [u.name for u in users if u.zerines < data.amount]
    if short:
        raise HTTPException(
            status_code=400,
            detail=f"Saldo insuficiente: {', '.join(short)}",
        )

    description = data.description
    body = f"{current_user.name} retiró {data.amount} zerines de tu cuenta. Motivo: {data.description}"
    transactions = []
    for user in users:
        user.zerines -= data.amount
        transaction = Transaction(
            sender_id=user.id,
            amount=data.amount,
            type="withdrawal",
            description=description,
            status="confirmed",
        )
        db.add(transaction)
        transactions.append(transaction)
        await notify(
            db,
            user_id=user.id,
            type=N.ZERINES_WITHDRAWN,
            title=f"Retiro de {data.amount} zerines",
            body=body,
            related_id=transaction.id,
            actor_id=current_user.id,
        )
    await db.commit()
    for transaction in transactions:
        await db.refresh(transaction)
    return transactions


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
