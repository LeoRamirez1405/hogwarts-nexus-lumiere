"""Admin-only catalog + catalog item management routes (prefix /admin/catalogs)."""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import String, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.roles import require_role
from ...models.catalog import Catalog
from ...models.catalog_item import CatalogItem
from ...models.user import User
from ...schemas.catalog import (
    CatalogCreate,
    CatalogItemCreate,
    CatalogItemPage,
    CatalogItemResponse,
    CatalogItemUpdate,
    CatalogResponse,
    CatalogUpdate,
)
from ...schemas.pagination import Page
from ...services.catalog_service import (
    catalog_response,
    get_catalog_or_404,
    get_item_or_404,
    get_next_numero,
)

router = APIRouter(prefix="/admin/catalogs", tags=["admin-catalogs"])


@router.post("/", response_model=CatalogResponse, status_code=status.HTTP_201_CREATED)
async def create_catalog(
    catalog_data: CatalogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    catalog = Catalog(**catalog_data.model_dump())
    db.add(catalog)
    await db.commit()
    await db.refresh(catalog)
    return await catalog_response(catalog, db)


@router.put("/{catalog_id}", response_model=CatalogResponse)
async def update_catalog(
    catalog_id: str,
    update_data: CatalogUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    catalog = await get_catalog_or_404(db, catalog_id)
    for key, value in update_data.model_dump(exclude_unset=True).items():
        setattr(catalog, key, value)
    await db.commit()
    await db.refresh(catalog)
    return await catalog_response(catalog, db)


@router.delete("/{catalog_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_catalog(
    catalog_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    catalog = await get_catalog_or_404(db, catalog_id)
    await db.delete(catalog)
    await db.commit()


@router.get("/{catalog_id}/items", response_model=CatalogItemPage)
async def admin_list_catalog_items(
    catalog_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(12, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    await get_catalog_or_404(db, catalog_id)
    query = select(CatalogItem).where(CatalogItem.catalog_id == catalog_id)
    count_query = select(func.count(CatalogItem.id)).where(
        CatalogItem.catalog_id == catalog_id
    )
    if search:
        search_term = f"%{search}%"
        search_filter = or_(
            CatalogItem.description.ilike(search_term),
            CatalogItem.numero.cast(String).ilike(search_term),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
    query = query.order_by(CatalogItem.numero.asc()).offset(skip).limit(limit + 1)
    result = await db.execute(query)
    items = result.scalars().all()
    has_more = len(items) > limit
    items = items[:limit]
    for item in items:
        item.is_favorite = False
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()
    return Page(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
        has_more=has_more,
    )


@router.post(
    "/{catalog_id}/items",
    response_model=CatalogItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_catalog_item(
    catalog_id: str,
    item_data: CatalogItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    await get_catalog_or_404(db, catalog_id)
    numero = await get_next_numero(db, catalog_id)
    item = CatalogItem(
        catalog_id=catalog_id,
        numero=numero,
        **item_data.model_dump(),
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    item.is_favorite = False
    return item


@router.put("/items/{item_id}", response_model=CatalogItemResponse)
async def update_catalog_item(
    item_id: str,
    update_data: CatalogItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    item = await get_item_or_404(db, item_id)
    for key, value in update_data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    await db.commit()
    await db.refresh(item)
    item.is_favorite = False
    return item


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_catalog_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    item = await get_item_or_404(db, item_id)
    await db.delete(item)
    await db.commit()
