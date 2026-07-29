from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class TransactionCreate(BaseModel):
    amount: int
    description: str = Field(..., min_length=1, max_length=500)


class TransferRequest(BaseModel):
    receiver_id: str
    amount: int
    description: str = Field(..., min_length=1, max_length=500)


class UserBrief(BaseModel):
    id: str
    name: str
    email: str
    avatar_url: Optional[str] = None
    house: Optional[str] = None

    class Config:
        from_attributes = True


class TransactionResponse(BaseModel):
    id: str
    sender_id: Optional[str] = None
    receiver_id: Optional[str] = None
    sender: Optional[UserBrief] = None
    receiver: Optional[UserBrief] = None
    amount: int
    type: str
    description: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
