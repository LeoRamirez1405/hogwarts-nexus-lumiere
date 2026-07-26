from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from .user import UserResponse


class ChatRoomCreate(BaseModel):
    name: str
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    type: str = "group"
    member_ids: List[str] = Field(default_factory=list)


class ChatRoomUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None


class ChatRoomMemberResponse(BaseModel):
    id: str
    room_id: str
    user_id: str
    role: str
    joined_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class ChatRoomResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    type: str
    created_by: str
    created_at: datetime
    members: List[ChatRoomMemberResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class ChatRoomBrief(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    type: str
    created_by: str
    created_at: datetime
    member_count: int = 0

    class Config:
        from_attributes = True


class PollOptionCreate(BaseModel):
    label: str


class PollCreate(BaseModel):
    question: str
    options: List[str] = Field(min_length=2, max_length=10)
    multi_choice: bool = False


class PollVoteRequest(BaseModel):
    option_ids: List[str]


class PollOptionResponse(BaseModel):
    id: str
    label: str
    option_index: int
    votes_count: int = 0
    voted_by_me: bool = False

    class Config:
        from_attributes = True


class PollResponse(BaseModel):
    id: str
    question: str
    multi_choice: bool
    total_votes: int = 0
    options: List[PollOptionResponse] = Field(default_factory=list)
    my_option_ids: List[str] = Field(default_factory=list)

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    receiver_id: Optional[str] = None
    room_id: Optional[str] = None
    body: Optional[str] = None
    kind: str = "text"
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = None
    attachment_name: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    poll: Optional[PollCreate] = None


class MessageResponse(BaseModel):
    id: str
    sender_id: str
    receiver_id: Optional[str] = None
    room_id: Optional[str] = None
    kind: str
    body: Optional[str] = None
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = None
    attachment_name: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    read: bool
    created_at: datetime
    sender: Optional[UserResponse] = None
    receiver: Optional[UserResponse] = None
    room: Optional[ChatRoomBrief] = None
    poll: Optional[PollResponse] = None

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    type: str  # "direct" | "room"
    id: str  # user id or room id
    name: str
    avatar_url: Optional[str] = None
    subtitle: Optional[str] = None  # e.g. "@house" or "N miembros"
    last_message: Optional[MessageResponse] = None
    unread_count: int = 0
