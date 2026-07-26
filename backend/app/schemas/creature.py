from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class CreatureCreate(BaseModel):
    name: str
    description: Optional[str] = None
    rarity: str
    price: int
    image_url: Optional[str] = None


class CreatureResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    rarity: str
    price: int
    image_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AdoptRequest(BaseModel):
    pass


class FeedRequest(BaseModel):
    amount: int = 10


class UserCreatureResponse(BaseModel):
    id: str
    user_id: str
    creature_id: str
    creature: Optional[CreatureResponse] = None
    level: int
    hunger: int
    happiness: int
    adopted_at: datetime

    class Config:
        from_attributes = True
