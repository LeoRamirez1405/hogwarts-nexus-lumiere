"""Reaction schemas for posts, comments, forum threads, articles."""

from datetime import datetime
from typing import List

from pydantic import BaseModel, Field


class ReactionCreate(BaseModel):
    target_type: str
    target_id: str
    emoji: str = Field(min_length=1, max_length=16)

    class Config:
        from_attributes = True


class ReactionResponse(BaseModel):
    id: str
    target_type: str
    target_id: str
    user_id: str
    emoji: str
    created_at: datetime

    class Config:
        from_attributes = True


class ReactionToggleResponse(ReactionResponse):
    removed: bool = False


class ReactionSummaryItem(BaseModel):
    emoji: str
    count: int
    reacted_by_me: bool
    user_names: List[str] = Field(default_factory=list)


class ReactionListResponse(BaseModel):
    items: List[ReactionSummaryItem] = Field(default_factory=list)
    total: int = 0
