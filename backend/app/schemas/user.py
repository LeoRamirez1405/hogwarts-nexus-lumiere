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
    zerines: Optional[int] = None


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    zerines: int
    avatar_url: Optional[str] = None
    house: Optional[str] = None
    bio: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
