from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class TransactionCreate(BaseModel):
    amount: int
    description: Optional[str] = None


class TransferRequest(BaseModel):
    receiver_id: str
    amount: int
    description: Optional[str] = None


class TransactionResponse(BaseModel):
    id: str
    sender_id: Optional[str] = None
    receiver_id: Optional[str] = None
    amount: int
    type: str
    description: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
