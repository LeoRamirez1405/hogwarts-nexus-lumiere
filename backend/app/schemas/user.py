from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    house: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    house: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    status: Optional[str] = None
    wand: Optional[str] = None
    location: Optional[str] = None
    zerines: Optional[int] = None


class AdminTitleUpdate(BaseModel):
    official_title: Optional[str] = None


class MagicLevelInfo(BaseModel):
    level: int
    name: str
    xp: int
    progress: float
    next_xp: int


class HousePoints(BaseModel):
    house: str
    points: int


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    zerines: int
    avatar_url: Optional[str] = None
    house: Optional[str] = None
    bio: Optional[str] = None
    status: Optional[str] = None
    wand: Optional[str] = None
    location: Optional[str] = None
    official_title: Optional[str] = None
    last_active_at: Optional[datetime] = None
    magic_level: Optional[MagicLevelInfo] = None
    created_at: datetime

    class Config:
        from_attributes = True
