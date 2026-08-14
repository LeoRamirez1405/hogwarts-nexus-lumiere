from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class RewardCreate(BaseModel):
    user_ids: List[str]
    pack_type_id: str
    quantity: int = 1
    message: Optional[str] = None


class RewardResponse(BaseModel):
    id: str
    admin_id: str
    admin_name: str
    user_id: str
    user_name: str
    pack_type_id: str
    pack_type_name: str
    quantity: int
    message: Optional[str] = None
    created_at: datetime