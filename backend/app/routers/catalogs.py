"""User-facing catalog browsing routes (prefix /catalogs)."""


from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..middleware.auth import get_current_user
from ..models.catalog import Catalog
from ..models.user import User
from ..schemas.catalog import (
    CatalogItemPage,
    CatalogItemResponse,
    CatalogResponse,
)
from ..schemas.pagination import Page
from ..services.catalog_service import (
    catalog_response,
    get_catalog_or_404,
    get_item_or_404,
    list_catalog_items,
    toggle_favorite,
)

router = APIRouter()


@router.get("/", response_model=Page[CatalogResponse])
async def list_catalogs(
    skip: int = Query(0, ge=0),
    limit: int = Query(12, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Catalog).order_by(Catalog.created_at.desc()).offset(skip).limit(limit + 1)
    )
    items = result.scalars().all()
    has_more = len(items) > limit
    items = items[:limit]
    total_result = await db.execute(select(func.count(Catalog.id)))
    total = total_result.scalar_one()
    items = [await catalog_response(c, db) for c in items]
    return Page(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
        has_more=has_more,
    )


@router.get("/{catalog_id}", response_model=CatalogResponse)
async def get_catalog(
    catalog_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    catalog = await get_catalog_or_404(db, catalog_id)
    return await catalog_response(catalog, db)


@router.get("/{catalog_id}/items", response_model=CatalogItemPage)
async def get_catalog_items(
    catalog_id: str,
    only_favorites: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(12, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await get_catalog_or_404(db, catalog_id)
    return await list_catalog_items(
        db, catalog_id, current_user.id, only_favorites, skip, limit
    )


@router.post(
    "/items/{item_id}/favorite",
    response_model=CatalogItemResponse,
)
async def favorite_catalog_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = await get_item_or_404(db, item_id)
    item.is_favorite = await toggle_favorite(db, current_user.id, item_id)
    return item
