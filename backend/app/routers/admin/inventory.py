"""Admin-only inventory consumption routes (prefix /admin/inventory)."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from ...database import get_db
from ...middleware.roles import require_role
from ...models.product import Product
from ...models.user import User
from ...models.user_product import UserProduct
from ...notifications_service import N, notify
from ...routers.audit_logs import log_audit
from ...schemas.inventory import InventoryRemoveRequest, UserProductAdminResponse
from ...schemas.pagination import Page

router = APIRouter(prefix="/admin/inventory", tags=["admin-inventory"])


@router.get("/", response_model=Page[UserProductAdminResponse])
async def list_inventory_admin(
    shop: Optional[str] = Query(None, description="Filtrar por marketplace: borgin o flourish"),
    search: Optional[str] = Query(None, description="Buscar por nombre de usuario, email o producto"),
    date_from: Optional[datetime] = Query(None, description="Fecha desde (purchased_at)"),
    date_to: Optional[datetime] = Query(None, description="Fecha hasta (purchased_at)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    query = (
        select(UserProduct)
        .options(
            joinedload(UserProduct.user),
            joinedload(UserProduct.product),
        )
    )
    count_query = select(func.count(UserProduct.id))

    if shop:
        query = query.join(Product, UserProduct.product_id == Product.id).where(Product.shop == shop)
        count_query = count_query.join(Product, UserProduct.product_id == Product.id).where(Product.shop == shop)

    if search:
        search_term = f"%{search.lower()}%"
        query = query.join(User, UserProduct.user_id == User.id).join(Product, UserProduct.product_id == Product.id).where(
            or_(
                User.name.ilike(search_term),
                User.email.ilike(search_term),
                Product.name.ilike(search_term),
            )
        )
        count_query = count_query.join(User, UserProduct.user_id == User.id).join(Product, UserProduct.product_id == Product.id).where(
            or_(
                User.name.ilike(search_term),
                User.email.ilike(search_term),
                Product.name.ilike(search_term),
            )
        )

    if date_from:
        query = query.where(UserProduct.purchased_at >= date_from)
        count_query = count_query.where(UserProduct.purchased_at >= date_from)
    if date_to:
        query = query.where(UserProduct.purchased_at <= date_to)
        count_query = count_query.where(UserProduct.purchased_at <= date_to)

    query = (
        query.order_by(UserProduct.purchased_at.desc())
        .offset(skip)
        .limit(limit + 1)
    )

    result = await db.execute(query)
    items = result.scalars().all()
    has_more = len(items) > limit
    items = items[:limit]

    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    return Page(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
        has_more=has_more,
    )


@router.post("/{user_product_id}/remove")
async def remove_inventory_item(
    user_product_id: str,
    request: InventoryRemoveRequest,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(
        select(UserProduct)
        .options(
            joinedload(UserProduct.user),
            joinedload(UserProduct.product),
        )
        .where(UserProduct.id == user_product_id)
    )
    user_product = result.scalar_one_or_none()

    if not user_product:
        raise HTTPException(status_code=404, detail="Inventario no encontrado")

    if request.quantity > user_product.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cantidad a retirar ({request.quantity}) supera la disponible ({user_product.quantity})",
        )

    previous_quantity = user_product.quantity
    new_quantity = user_product.quantity - request.quantity

    if new_quantity <= 0:
        await db.delete(user_product)
    else:
        user_product.quantity = new_quantity

    await db.commit()

    await log_audit(
        db=db,
        actor=current_user,
        action="inventory_remove",
        entity_type="user_product",
        entity_id=user_product_id,
        details={
            "user_id": user_product.user_id,
            "user_name": user_product.user.name,
            "product_id": user_product.product_id,
            "product_name": user_product.product.name,
            "previous_quantity": previous_quantity,
            "removed_quantity": request.quantity,
            "new_quantity": max(0, new_quantity),
            "shop": user_product.product.shop,
        },
        request=req,
    )

    # Notify the user whose inventory was modified
    await notify(
        db=db,
        user_id=user_product.user_id,
        type=N.INVENTORY_CONSUMED,
        title="Objeto consumido",
        body=f"Un administrador ha retirado {request.quantity} unidad{'' if request.quantity == 1 else 'es'} de \"{user_product.product.name}\" de tu inventario.",
        related_id=user_product.product_id,
        actor_id=current_user.id,
        force=True,
    )
    await db.commit()

    return {
        "success": True,
        "removed_quantity": request.quantity,
        "remaining_quantity": max(0, new_quantity),
        "deleted": new_quantity <= 0,
    }