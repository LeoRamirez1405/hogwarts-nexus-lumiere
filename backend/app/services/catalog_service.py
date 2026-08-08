"""Catalog listing + favorites logic shared by user and admin routers."""


from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.catalog import Catalog
from ..models.catalog_item import CatalogItem
from ..models.catalog_item_favorite import CatalogItemFavorite
from ..schemas.pagination import Page


async def get_catalog_or_404(db: AsyncSession, catalog_id: str) -> Catalog:
    result = await db.execute(select(Catalog).where(Catalog.id == catalog_id))
    catalog = result.scalar_one_or_none()
    if not catalog:
        raise HTTPException(status_code=404, detail="Catalog not found")
    return catalog


async def get_item_or_404(db: AsyncSession, item_id: str) -> CatalogItem:
    result = await db.execute(select(CatalogItem).where(CatalogItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Catalog item not found")
    return item


async def get_next_numero(db: AsyncSession, catalog_id: str) -> int:
    result = await db.execute(
        select(func.coalesce(func.max(CatalogItem.numero), 0)).where(
            CatalogItem.catalog_id == catalog_id
        )
    )
    return int(result.scalar_one() or 0) + 1


async def catalog_response(catalog: Catalog, db: AsyncSession) -> Catalog:
    total_result = await db.execute(
        select(func.count(CatalogItem.id)).where(CatalogItem.catalog_id == catalog.id)
    )
    catalog.item_count = int(total_result.scalar_one() or 0)
    return catalog


async def list_catalog_items(
    db: AsyncSession,
    catalog_id: str,
    user_id: str,
    only_favorites: bool,
    skip: int,
    limit: int,
) -> "Page":
    """Paginated items. ORM objects are serialized by the router's
    response_model; ``is_favorite`` is attached as a transient attribute.
    """
    query = select(CatalogItem).where(CatalogItem.catalog_id == catalog_id)
    count_query = select(func.count(CatalogItem.id)).where(
        CatalogItem.catalog_id == catalog_id
    )
    if only_favorites:
        fav_filter = (
            select(CatalogItemFavorite.catalog_item_id).where(
                CatalogItemFavorite.user_id == user_id
            )
        )
        query = query.where(CatalogItem.id.in_(fav_filter))
        count_query = count_query.where(CatalogItem.id.in_(fav_filter))

    fav_ids = set(
        (
            await db.execute(
                select(CatalogItemFavorite.catalog_item_id).where(
                    CatalogItemFavorite.user_id == user_id
                )
            )
        ).scalars().all()
    )

    query = query.order_by(CatalogItem.numero.asc()).offset(skip).limit(limit + 1)
    result = await db.execute(query)
    items = result.scalars().all()
    has_more = len(items) > limit
    items = items[:limit]

    for item in items:
        item.is_favorite = item.id in fav_ids

    total_result = await db.execute(count_query)
    total = total_result.scalar_one()
    return Page(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
        has_more=has_more,
    )


async def toggle_favorite(db: AsyncSession, user_id: str, item_id: str) -> bool:
    """Returns True if the item is now favorited, False if it was removed."""
    result = await db.execute(
        select(CatalogItemFavorite).where(
            CatalogItemFavorite.user_id == user_id,
            CatalogItemFavorite.catalog_item_id == item_id,
        )
    )
    fav = result.scalar_one_or_none()
    if fav:
        await db.delete(fav)
        await db.commit()
        return False
    db.add(
        CatalogItemFavorite(
            user_id=user_id,
            catalog_item_id=item_id,
        )
    )
    await db.commit()
    return True
