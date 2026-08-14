from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from .pack import UserPackResponse


class RouletteSegment(BaseModel):
    # prize: "pack:N" | "zerines:N" | "legendary"
    prize: str
    label: str
    weight: int
    pack_type_id: Optional[str] = None


class RouletteConfigResponse(BaseModel):
    cost_zerines: int
    segments: List[RouletteSegment] = []
    enabled: bool
    updated_at: datetime


class RouletteConfigUpdate(BaseModel):
    cost_zerines: int
    segments: List[RouletteSegment]
    enabled: bool = True


class SpinResponse(BaseModel):
    spin_id: str
    cost: int
    prize: str
    label: str
    packs_granted: List[UserPackResponse] = []
    zerines_won: int = 0
    xp_won: int = 0
    free_spins_won: int = 0
    created_at: datetime


class RouletteSpinResponse(BaseModel):
    id: str
    user_id: str
    cost: int
    result: Optional[dict] = None
    created_at: datetime