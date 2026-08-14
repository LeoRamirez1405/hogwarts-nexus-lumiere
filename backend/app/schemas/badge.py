from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class BadgeResponse(BaseModel):
    badge_key: str
    label: str
    icon: Optional[str] = None
    granted_at: datetime