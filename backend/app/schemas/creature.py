from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class CreatureCreate(BaseModel):
    name: str
    description: Optional[str] = None
    rarity: str
    pet_type: str = "critter"  # avian / beast / critter
    price: int
    image_url: Optional[str] = None
    required_user_level: int = 1
    required_sanctuary_level: int = 0
    ability: Optional[str] = None


class CreatureResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    rarity: str
    pet_type: str
    price: int
    image_url: Optional[str] = None
    required_user_level: int = 1
    required_sanctuary_level: int = 0
    ability: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AdoptRequest(BaseModel):
    pet_name: Optional[str] = None


class UseItemRequest(BaseModel):
    item_id: str


class UserCreatureResponse(BaseModel):
    id: str
    user_id: str
    creature_id: str
    creature: Optional[CreatureResponse] = None
    pet_name: Optional[str] = None
    level: int
    level_name: str = ""
    hunger: int
    happiness: int
    mood: str = "bien"
    age_days: int = 0
    stage: str = "cria"
    for_sale: bool = False
    sale_price: Optional[int] = None
    adopted_at: datetime

    class Config:
        from_attributes = True


class MarketCreatureResponse(BaseModel):
    """A pet listed for sale, as seen by other users in the market."""
    id: str
    creature: Optional[CreatureResponse] = None
    pet_name: Optional[str] = None
    level: int
    level_name: str = ""
    stage: str = "cria"
    sale_price: int
    seller_id: str
    seller_name: str

    class Config:
        from_attributes = True


class ListForSaleRequest(BaseModel):
    price: int


class SanctuaryStats(BaseModel):
    sanctuary_level: int
    sanctuary_score: int
    sanctuary_max: int
    sanctuary_progress: dict
    # User (magic) level — the person's own level shown in their profile.
    user_level: int
    user_level_name: str
    user_level_max: int
    user_progress: float  # 0..1 toward next user level
    pets_count: int
