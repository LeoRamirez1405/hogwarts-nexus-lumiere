"""User-facing transaction routes. Admin-wide listing lives in routers.admin.transactions."""

from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_, select, func
from sqlalchemy.orm import joinedload

from ..database import get_db
from ..models.transaction import Transaction
from ..models.user import User
from ..schemas.transaction import TransactionCreate, TransferRequest, TransactionResponse
from ..schemas.pagination import Page
from ..middleware.auth import get_current_user
from ..notifications_service import notify, N

router = APIRouter()


@router.get("/", response_model=Page[TransactionResponse])
async def list_transactions(
    type: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    own_filter = (
        (Transaction.sender_id == current_user.id)
        | (Transaction.receiver_id == current_user.id)
    )
    query = (
        select(Transaction)
        .options(
            joinedload(Transaction.sender),
            joinedload(Transaction.receiver),
        )
        .where(own_filter)
    )
    count_query = select(func.count(Transaction.id)).where(own_filter)
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


@router.post("/deposit", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def deposit(
    data: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    current_user.zerines += data.amount
    transaction = Transaction(
        receiver_id=current_user.id,
        amount=data.amount,
        type="deposit",
        description=data.description,
        status="confirmed",
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)
    return transaction


@router.post("/withdraw", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def withdraw(
    data: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    if current_user.zerines < data.amount:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient zerines. Have {current_user.zerines}, need {data.amount}",
        )

    current_user.zerines -= data.amount
    transaction = Transaction(
        sender_id=current_user.id,
        amount=data.amount,
        type="withdrawal",
        description=data.description,
        status="confirmed",
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)
    return transaction


@router.post("/transfer", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def transfer(
    data: TransferRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    if data.receiver_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot transfer to yourself")

    if current_user.zerines < data.amount:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient zerines. Have {current_user.zerines}, need {data.amount}",
        )

    receiver_result = await db.execute(
        select(User).where(User.id == data.receiver_id)
    )
    receiver = receiver_result.scalar_one_or_none()
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")

    current_user.zerines -= data.amount
    receiver.zerines += data.amount

    transaction = Transaction(
        sender_id=current_user.id,
        receiver_id=data.receiver_id,
        amount=data.amount,
        type="transfer",
        description=data.description,
        status="confirmed",
    )
    db.add(transaction)
    await db.flush()
    await notify(
        db,
        user_id=receiver.id,
        type=N.ZERINES_RECEIVED,
        title=f"Recibiste {data.amount} zerines",
        body=f"{current_user.name} te transfirió {data.amount} zerines.",
        related_id=transaction.id,
        actor_id=current_user.id,
    )
    await db.commit()
    await db.refresh(transaction)
    return transaction
