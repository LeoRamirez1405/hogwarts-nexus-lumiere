from datetime import datetime
from typing import List, Optional
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
    requires_specification: bool = False
    specification_placeholder: Optional[str] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[int] = None
    category: Optional[str] = None
    shop: Optional[str] = None
    image_url: Optional[str] = None
    stock: Optional[int] = None
    weekly_sales: Optional[int] = None
    requires_specification: Optional[bool] = None
    specification_placeholder: Optional[str] = None


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
    requires_specification: bool = False
    specification_placeholder: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserProductResponse(BaseModel):
    id: str
    user_id: str
    product_id: str
    product: Optional[ProductResponse] = None
    quantity: int
    specification: Optional[str] = None
    purchased_at: datetime

    class Config:
        from_attributes = True


class BatchPurchaseItem(BaseModel):
    product_id: str
    quantity: int = 1
    specification: Optional[str] = None


class SinglePurchaseRequest(BaseModel):
    quantity: int = 1
    specification: Optional[str] = None


class BatchPurchaseRequest(BaseModel):
    items: List[BatchPurchaseItem]


class BatchPurchaseResultItem(BaseModel):
    product_id: str
    name: str
    quantity: int
    price: int
    status: str
    error: Optional[str] = None


class BatchPurchaseResponse(BaseModel):
    success: bool
    purchased: List[BatchPurchaseResultItem]
    total_spent: int
    new_balance: int
