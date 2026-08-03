from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field

from .user import UserResponse


class VoiceChannelCreate(BaseModel):
    room_id: str
    name: str
    description: Optional[str] = None


class VoiceChannelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class VoiceChannelParticipantResponse(BaseModel):
    id: str
    channel_id: str
    user_id: str
    joined_at: datetime
    muted: bool = False
    deafened: bool = False
    video_enabled: bool = False
    screen_sharing: bool = False
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class VoiceChannelResponse(BaseModel):
    id: str
    room_id: str
    name: str
    description: Optional[str] = None
    created_by: str
    created_at: datetime
    participants: List[VoiceChannelParticipantResponse] = Field(
        default_factory=list
    )

    class Config:
        from_attributes = True


class VoiceChannelBrief(BaseModel):
    id: str
    room_id: str
    name: str
    description: Optional[str] = None
    created_by: str
    created_at: datetime
    participant_count: int = 0

    class Config:
        from_attributes = True


class MuteStateUpdate(BaseModel):
    muted: Optional[bool] = None
    deafened: Optional[bool] = None
    video_enabled: Optional[bool] = None
    screen_sharing: Optional[bool] = None
