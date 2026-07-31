from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class PushSubscriptionCreate(BaseModel):
    subscription_json: str
    user_agent: Optional[str] = None


class PushSubscriptionResponse(BaseModel):
    id: str
    user_id: str
    subscription_json: str
    user_agent: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PushSubscriptionDelete(BaseModel):
    endpoint: str