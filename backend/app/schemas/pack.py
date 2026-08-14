from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel


class PackTypeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price_zerines: int
    num_cards: int
    rarity_weights: Dict[str, int] = {}
    enabled: bool = True


class PackTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price_zerines: Optional[int] = None
    num_cards: Optional[int] = None
    rarity_weights: Optional[Dict[str, int]] = None
    enabled: Optional[bool] = None


class PackTypeResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    price_zerines: int
    num_cards: int
    rarity_weights: Dict[str, int] = {}
    enabled: bool
    created_at: datetime


class UserPackResponse(BaseModel):
    id: str
    pack_type_id: str
    pack_type_name: str
    album_id: str
    album_name: str
    origin: str
    opened: bool
    created_at: datetime


class BuyPackRequest(BaseModel):
    pack_type_id: str


class ExchangeRequest(BaseModel):
    card_ids: List[str]  # exactamente 3, cada una con quantity >= 2


class OpenedCard(BaseModel):
    card_id: str
    slot_number: int
    title: Optional[str] = None
    image_url: Optional[str] = None
    rarity: str
    is_new: bool
    foil: bool = False


class OpenPackResponse(BaseModel):
    pack_id: str
    pack_type_name: str
    cards: List[OpenedCard] = []
    # Progreso del sistema de piedad (sobres sin legendary desde la ultima).
    pity_progress: int = 0
    pity_target: int = 0


class PackStoreResponse(BaseModel):
    pack_types: List[PackTypeResponse] = []
    tray: List[UserPackResponse] = []  # sobres sin abrir


class DailyPackStatus(BaseModel):
    available: bool
    next_claim_at: Optional[datetime] = None