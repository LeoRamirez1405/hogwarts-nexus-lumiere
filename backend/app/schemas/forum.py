from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from .user import UserResponse


class ForumThreadCreate(BaseModel):
    title: str
    body: str
    category: str = "General"


class ForumThreadResponse(BaseModel):
    id: str
    author_id: str
    author: Optional[UserResponse] = None
    title: str
    body: str
    category: str
    created_at: datetime
    vote_count: int = 0
    my_vote: int = 0
    comment_count: int = 0
    subscribed: bool = False

    class Config:
        from_attributes = True


class ForumVoteRequest(BaseModel):
    value: int  # +1 or -1


class ForumCommentCreate(BaseModel):
    body: str
    parent_id: Optional[str] = None


class ForumCommentResponse(BaseModel):
    id: str
    thread_id: str
    user_id: str
    body: str
    parent_id: Optional[str] = None
    replies: list["ForumCommentResponse"] = []
    created_at: datetime
    author: Optional[UserResponse] = None

    class Config:
        from_attributes = True
