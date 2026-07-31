from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class FeatureFlagBase(BaseModel):
    name: str
    description: Optional[str] = None
    enabled: bool = True
    category: Optional[str] = None


class FeatureFlagCreate(FeatureFlagBase):
    key: str


class FeatureFlagUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None
    category: Optional[str] = None


class FeatureFlagResponse(FeatureFlagBase):
    key: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FeatureFlagListResponse(BaseModel):
    items: list[FeatureFlagResponse]
    total: int