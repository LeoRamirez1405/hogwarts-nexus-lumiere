from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class CreatureCreate(BaseModel):
    name: str
    description: Optional[str] = None
    rarity: str
    pet_type: str = "Criaturas pequeñas"
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
    is_critical: bool = False
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
    sanctuary_penalty: int = 0


from .pet_item import PetItemResponse, UserPetItemResponse  # noqa: E402


class MyFullStateResponse(BaseModel):
    """All state needed by the pets page, in one call.

    Consolidates: creatures catalog, my creatures, pet items catalog,
    my inventory, sanctuary stats, and (optionally) the creature market.

    `my_creatures` and `market` are paginated server-side (limit 50 by
    default). Use the matching `*_total`/`*_has_more` fields to drive a
    "Cargar mas" button in the UI, and call `/creatures/my` or
    `/creatures/market` with `skip`/`limit` to fetch the next pages.
    """
    creatures: List[CreatureResponse]
    my_creatures: List[UserCreatureResponse]
    my_creatures_total: int
    my_creatures_skip: int
    my_creatures_limit: int
    my_creatures_has_more: bool
    pet_items: List[PetItemResponse]
    inventory: List[UserPetItemResponse]
    stats: SanctuaryStats
    market: Optional[List[MarketCreatureResponse]] = None
    market_total: Optional[int] = None
    market_skip: Optional[int] = None
    market_limit: Optional[int] = None
    market_has_more: Optional[bool] = None
