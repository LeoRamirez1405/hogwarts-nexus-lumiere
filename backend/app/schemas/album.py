from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class AlbumCardCreate(BaseModel):
    slot_number: int
    title: Optional[str] = None
    image_url: Optional[str] = None
    rarity: str = "common"


class AlbumCreate(BaseModel):
    name: str
    description: Optional[str] = None
    cover_url: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    cards: List[AlbumCardCreate] = []


class AlbumUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cover_url: Optional[str] = None
    status: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


class AlbumCardResponse(BaseModel):
    id: str
    album_id: str
    slot_number: int
    title: Optional[str] = None
    image_url: Optional[str] = None
    rarity: str
    created_at: datetime


class AlbumResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    cover_url: Optional[str] = None
    status: str
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    first_completed_by: Optional[str] = None
    first_completed_at: Optional[datetime] = None
    created_at: datetime
    total_cards: int = 0


class AlbumDetailResponse(AlbumResponse):
    cards: List[AlbumCardResponse] = []


class AlbumGalleryItem(AlbumResponse):
    progress: int = 0
    percent: float = 0.0
    duplicate_count: int = 0


class CollectionCard(BaseModel):
    card_id: str
    slot_number: int
    title: Optional[str] = None
    image_url: Optional[str] = None
    rarity: str
    quantity: int
    foil: bool = False


class AlbumCollectionResponse(BaseModel):
    album: AlbumResponse
    owned: List[CollectionCard] = []
    progress: int = 0
    total: int = 0
    percent: float = 0.0
    # Copias extra por encima de la primera (alimentan el canje 3->1).
    duplicate_count: int = 0


class LeaderboardItem(BaseModel):
    user_id: str
    name: str
    avatar_url: Optional[str] = None
    house: Optional[str] = None
    progress: int = 0
    percent: float = 0.0
    first_completed: bool = False


class LeaderboardResponse(BaseModel):
    album_id: str
    total_participants: int
    entries: List[LeaderboardItem] = []


class CardStat(BaseModel):
    card_id: str
    slot_number: int
    title: Optional[str] = None
    rarity: str
    owners: int = 0
    total_users: int = 0


class CardStatsResponse(BaseModel):
    album_id: str
    total_users: int = 0
    cards: List[CardStat] = []