from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class EnumCategoryBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None


class EnumCategoryCreate(EnumCategoryBase):
    pass


class EnumCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class EnumCategoryResponse(EnumCategoryBase):
    id: str
    is_system: bool
    created_at: datetime

    class Config:
        from_attributes = True


class EnumValueBase(BaseModel):
    label: str
    description: Optional[str] = None


class EnumValueCreate(EnumValueBase):
    pass


class EnumValueUpdate(BaseModel):
    label: Optional[str] = None
    description: Optional[str] = None


class EnumValueResponse(EnumValueBase):
    id: str
    category_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EnumCategoryWithValues(EnumCategoryResponse):
    values: List[EnumValueResponse] = []