from datetime import datetime
from typing import Optional
from pydantic import BaseModel, model_validator

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
    body: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    video_poster_url: Optional[str] = None
    video_duration: Optional[float] = None
    parent_id: Optional[str] = None

    @model_validator(mode="after")
    def at_least_one_field(self):
        if not (self.body or "").strip() and not (
            (self.image_url or "").strip() or (self.video_url or "").strip()
        ):
            raise ValueError("Comment must have either body text, an image or a video")
        return self


class ForumCommentResponse(BaseModel):
    id: str
    thread_id: str
    user_id: str
    body: str
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    video_poster_url: Optional[str] = None
    video_duration: Optional[float] = None
    parent_id: Optional[str] = None
    replies: list["ForumCommentResponse"] = []
    created_at: datetime
    author: Optional[UserResponse] = None

    class Config:
        from_attributes = True
