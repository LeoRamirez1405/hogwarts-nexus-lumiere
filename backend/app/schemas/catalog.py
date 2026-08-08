from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from .pagination import Page


class CatalogCreate(BaseModel):
    name: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None


class CatalogUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cover_image_url: Optional[str] = None


class CatalogResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    item_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class CatalogItemCreate(BaseModel):
    description: Optional[str] = None
    image_url: Optional[str] = None


class CatalogItemUpdate(BaseModel):
    description: Optional[str] = None
    image_url: Optional[str] = None


class CatalogItemResponse(BaseModel):
    id: str
    catalog_id: str
    numero: int
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_favorite: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class CatalogItemPage(Page[CatalogItemResponse]):
    pass
