from typing import Generic, List, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class PageParams(BaseModel):
    skip: int = 0
    limit: int = 20


class Page(BaseModel, Generic[T]):
    items: List[T]
    total: int
    skip: int
    limit: int
    has_more: bool