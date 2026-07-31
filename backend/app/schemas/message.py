from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from .user import UserResponse


class ChatRoomCreate(BaseModel):
    name: str
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    type: str = "group"
    member_ids: List[str] = Field(min_length=2)


class ChatRoomUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    closed: Optional[bool] = None


class ChatRoomMemberResponse(BaseModel):
    id: str
    room_id: str
    user_id: str
    role: str
    muted_until: Optional[datetime] = None
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
    closed: bool = False
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
    closed: bool = False
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


class ReactionCreate(BaseModel):
    emoji: str

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    receiver_id: Optional[str] = None
    room_id: Optional[str] = None
    reply_to_id: Optional[str] = None
    body: Optional[str] = None
    kind: str = "text"
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = None
    attachment_name: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    poll: Optional[PollCreate] = None


class MessageReactionResponse(BaseModel):
    id: str
    message_id: str
    user_id: str
    emoji: str
    created_at: datetime

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    id: str
    sender_id: str
    receiver_id: Optional[str] = None
    room_id: Optional[str] = None
    reply_to_id: Optional[str] = None
    kind: str
    body: Optional[str] = None
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = None
    attachment_name: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    read: bool
    pinned: bool = False
    edited: bool = False
    edited_at: Optional[datetime] = None
    created_at: datetime
    sender: Optional[UserResponse] = None
    receiver: Optional[UserResponse] = None
    room: Optional[ChatRoomBrief] = None
    poll: Optional[PollResponse] = None
    reply_to: Optional["MessageResponse"] = None
    reactions: List[MessageReactionResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class MessagePage(BaseModel):
    """A page of messages, oldest-first, for lazy/infinite scroll.

    `has_more` tells the client there are still older messages before the
    first item in this page (so it can prefetch the next page upward).
    `first_unread_id` / `unread_count` are only populated on the initial
    load (no cursor) so the client can draw a "no leídos" divider.
    """
    messages: List[MessageResponse] = Field(default_factory=list)
    has_more: bool = False
    first_unread_id: Optional[str] = None
    unread_count: int = 0


class ConversationResponse(BaseModel):
    type: str  # "direct" | "room"
    id: str  # user id or room id
    name: str
    avatar_url: Optional[str] = None
    subtitle: Optional[str] = None  # e.g. "@house" or "N miembros"
    last_message: Optional[MessageResponse] = None
    unread_count: int = 0
    hidden: bool = False
    is_muted: bool = False
    last_active_at: Optional[datetime] = None
    online_count: int = 0


class MuteRequest(BaseModel):
    duration: str  # "8h" | "24h" | "forever" | "off"


# WebSocket message types
class WSMessageBase(BaseModel):
    t: str  # message type: "msg", "typing", "read", "presence", "reaction", "delete", "edit", "ping", "pong"


class WSSendMessage(WSMessageBase):
    t: str = "send_message"
    c: str  # conversation_id (room_id or user_id)
    m: Dict[str, Any]  # message data
    ts: int


class WSTypingStart(WSMessageBase):
    t: str = "typing_start"
    c: str  # conversation_id


class WSTypingStop(WSMessageBase):
    t: str = "typing_stop"
    c: str  # conversation_id


class WSMarkRead(WSMessageBase):
    t: str = "mark_read"
    c: str  # conversation_id
    m: str  # message_id


class WSPing(WSMessageBase):
    t: str = "ping"


# Server -> Client
class WSNewMessage(WSMessageBase):
    t: str = "new_message"
    c: str  # conversation_id
    m: Dict[str, Any]  # full message


class WSTyping(WSMessageBase):
    t: str = "typing"
    c: str  # conversation_id
    u: str  # user_id


class WSPresence(WSMessageBase):
    t: str = "presence"
    u: str  # user_id
    s: str  # status: "online" | "offline"


class WSReadReceipt(WSMessageBase):
    t: str = "read_receipt"
    c: str  # conversation_id
    m: str  # message_id
    u: str  # read_by user_id
    ts: int


class WSReactionUpdate(WSMessageBase):
    t: str = "reaction_update"
    c: str  # conversation_id
    m: str  # message_id
    r: List[MessageReactionResponse]


class WSMessageDelete(WSMessageBase):
    t: str = "delete"
    c: str  # conversation_id
    m: str  # message_id


class WSMessageEdit(WSMessageBase):
    t: str = "edit"
    c: str  # conversation_id
    m: Dict[str, Any]  # updated message


class WSPong(WSMessageBase):
    t: str = "pong"


class UserSearchResult(BaseModel):
    id: str
    name: str
    avatar_url: Optional[str] = None
    house: Optional[str] = None
