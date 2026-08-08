from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class UserBrief(BaseModel):
    id: str
    name: str
    email: str
    avatar_url: Optional[str] = None
    house: Optional[str] = None

    class Config:
        from_attributes = True


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


class UserProductAdminResponse(BaseModel):
    id: str
    user_id: str
    user: UserBrief
    product_id: str
    product: ProductResponse
    quantity: int
    specification: Optional[str] = None
    purchased_at: datetime

    class Config:
        from_attributes = True


class InventoryRemoveRequest(BaseModel):
    quantity: int = Field(..., ge=1, description="Cantidad a retirar del inventario")