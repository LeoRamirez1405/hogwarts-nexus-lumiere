from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models.transaction import Transaction
from ..models.user import User
from ..schemas.transaction import TransactionCreate, TransferRequest, TransactionResponse
from ..middleware.auth import get_current_user

router = APIRouter()


@router.get("/", response_model=List[TransactionResponse])
async def list_transactions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Transaction)
        .where(
            (Transaction.sender_id == current_user.id)
            | (Transaction.receiver_id == current_user.id)
        )
        .order_by(Transaction.created_at.desc())
    )
    return result.scalars().all()


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
        description=data.description or "Deposit",
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
        description=data.description or "Withdrawal",
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
        description=data.description or f"Transfer to {receiver.name}",
        status="confirmed",
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)
    return transaction
