"""User-facing catalog browsing routes (prefix /catalogs)."""


from typing import Optional

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..cache import cache_get, cache_set
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

_CATALOGS_TTL = 120


@router.get("/", response_model=Page[CatalogResponse])
async def list_catalogs(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(12, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cache_key = f"catalogs:{skip}:{limit}:{search}"
    cached = cache_get(cache_key)
    if cached is not None:
        response.headers["Cache-Control"] = f"private, max-age={_CATALOGS_TTL}"
        return cached
    query = select(Catalog)
    count_query = select(func.count(Catalog.id))
    if search:
        search_term = f"%{search}%"
        search_filter = or_(
            Catalog.name.ilike(search_term),
            Catalog.description.ilike(search_term),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
    result = await db.execute(
        query.order_by(Catalog.created_at.desc()).offset(skip).limit(limit + 1)
    )
    items = result.scalars().all()
    has_more = len(items) > limit
    items = items[:limit]
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()
    payload = Page(
        items=[await catalog_response(c, db) for c in items],
        total=total,
        skip=skip,
        limit=limit,
        has_more=has_more,
    )
    cache_set(cache_key, payload, _CATALOGS_TTL)
    response.headers["Cache-Control"] = f"private, max-age={_CATALOGS_TTL}"
    return payload


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
