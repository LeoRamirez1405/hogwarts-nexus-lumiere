from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class AnnouncementCreate(BaseModel):
    body: str


class AnnouncementUpdate(BaseModel):
    body: Optional[str] = None


class AnnouncementResponse(BaseModel):
    id: str
    body: str
    created_at: datetime

    class Config:
        from_attributes = True


class ClassifiedCreate(BaseModel):
    title: str
    price: str


class ClassifiedUpdate(BaseModel):
    title: Optional[str] = None
    price: Optional[str] = None


class ClassifiedResponse(BaseModel):
    id: str
    title: str
    price: str
    created_at: datetime

    class Config:
        from_attributes = True
