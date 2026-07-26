from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: int
    category: Optional[str] = None
    shop: str
    image_url: Optional[str] = None
    stock: int = 0
    weekly_sales: int = 0


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[int] = None
    category: Optional[str] = None
    shop: Optional[str] = None
    image_url: Optional[str] = None
    stock: Optional[int] = None
    weekly_sales: Optional[int] = None


class ProductResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    price: int
    category: Optional[str] = None
    shop: str
    image_url: Optional[str] = None
    stock: int
    weekly_sales: int
    created_at: datetime

    class Config:
        from_attributes = True
