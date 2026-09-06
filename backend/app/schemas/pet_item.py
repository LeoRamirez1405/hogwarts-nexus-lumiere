from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class PetItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    kind: str  # food / toy
    pet_type: str  # avian / beast / critter
    price: int = Field(ge=0)
    restore_amount: int = Field(default=10, ge=1, le=100)
    pack_size: int = Field(default=1, ge=1)
    image_url: Optional[str] = None


class PetItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    kind: Optional[str] = None
    pet_type: Optional[str] = None
    price: Optional[int] = Field(default=None, ge=0)
    restore_amount: Optional[int] = Field(default=None, ge=1, le=100)
    pack_size: Optional[int] = Field(default=None, ge=1)
    image_url: Optional[str] = None


class PetItemResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    kind: str
    pet_type: str
    price: int
    restore_amount: int
    pack_size: int
    image_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserPetItemResponse(BaseModel):
    id: str
    pet_item_id: str
    quantity: int
    pet_item: Optional[PetItemResponse] = None

    class Config:
        from_attributes = True


class UseItemRequest(BaseModel):
    item_id: str
