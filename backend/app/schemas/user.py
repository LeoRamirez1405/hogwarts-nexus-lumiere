from datetime import datetime
from typing import Optional
from pydantic import BaseModel


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
    house_points: Optional[int] = None
    receive_marketplace_notifications: Optional[bool] = None


class AdminCreateUser(BaseModel):
    name: str
    email: str
    password: str
    house: Optional[str] = None
    role: str = "user"


class AdminUpdateUser(BaseModel):
    name: Optional[str] = None
    house: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None


class AdminTitleUpdate(BaseModel):
    official_title: Optional[str] = None


class HousePointsAdjust(BaseModel):
    points: int
    reason: Optional[str] = None


class ChangePassword(BaseModel):
    current_password: str
    new_password: str


class AdminResetPassword(BaseModel):
    new_password: str


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
    house_points: int = 0
    avatar_url: Optional[str] = None
    house: Optional[str] = None
    bio: Optional[str] = None
    status: Optional[str] = None
    wand: Optional[str] = None
    location: Optional[str] = None
    official_title: Optional[str] = None
    last_active_at: Optional[datetime] = None
    magic_level: Optional[MagicLevelInfo] = None
    daily_logins: int = 0
    profile_completed_at: Optional[datetime] = None
    sanctuary_penalty: int = 0
    receive_marketplace_notifications: bool = True
    created_at: datetime

    class Config:
        from_attributes = True
