from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, or_, select, update

from ..database import get_db
from ..models.product import Product
from ..models.user import User
from ..models.user_product import UserProduct
from ..models.transaction import Transaction
from ..schemas.product import (
    ProductResponse,
    UserProductResponse,
    BatchPurchaseRequest,
    BatchPurchaseResponse,
    BatchPurchaseResultItem,
    SinglePurchaseRequest,
)
from ..schemas.pagination import Page
from ..middleware.auth import get_current_user

router = APIRouter()


@router.get("/", response_model=Page[ProductResponse])
async def list_products(
    shop: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Product)
    count_query = select(func.count(Product.id))
    if shop:
        query = query.where(Product.shop == shop)
        count_query = count_query.where(Product.shop == shop)
    if category:
        query = query.where(Product.category == category)
        count_query = count_query.where(Product.category == category)
    if search:
        search_term = f"%{search}%"
        search_filter = or_(
            Product.name.ilike(search_term),
            Product.description.ilike(search_term),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
    query = query.order_by(Product.created_at.desc()).offset(skip).limit(limit + 1)
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


@router.get("/popular/{shop}", response_model=List[ProductResponse])
async def get_popular_products(
    shop: str,
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Product)
        .where(Product.shop == shop)
        .order_by(Product.weekly_sales.desc())
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/{product_id}/purchase", response_model=ProductResponse)
async def purchase_product(
    product_id: str,
    body: SinglePurchaseRequest = SinglePurchaseRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quantity = body.quantity or 1
    specification = body.specification
    if quantity < 1:
        raise HTTPException(status_code=400, detail="Quantity must be positive")

    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if product.requires_specification and not (specification or "").strip():
        raise HTTPException(
            status_code=400,
            detail=(
                f"Este producto requiere una especificacion: "
                f"{product.specification_placeholder or 'especifica los detalles'}"
            ),
        )

    total = product.price * quantity
    if current_user.zerines < total:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient zerines. Need {total}, have {current_user.zerines}",
        )

    # Atomic stock decrement: the WHERE clause re-checks the stock inside the
    # UPDATE, so two concurrent requests can't both pass the old
    # `if product.stock < quantity` check and oversell.
    update_result = await db.execute(
        update(Product)
        .where(Product.id == product_id, Product.stock >= quantity)
        .values(
            stock=Product.stock - quantity,
            weekly_sales=Product.weekly_sales + quantity,
        )
    )
    if update_result.rowcount == 0:
        raise HTTPException(status_code=400, detail="Insufficient stock")

    current_user.zerines -= total

    user_product = UserProduct(
        user_id=current_user.id,
        product_id=product_id,
        quantity=quantity,
        specification=(specification or "").strip() or None,
    )
    db.add(user_product)

    transaction = Transaction(
        sender_id=current_user.id,
        amount=total,
        type="purchase",
        description=f"Compra: {product.name} x{quantity}",
        status="confirmed",
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(product)
    return product


@router.post("/batch-purchase", response_model=BatchPurchaseResponse)
async def batch_purchase(
    data: BatchPurchaseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Compra atomica de multiples productos en una sola transaccion.

    Si cualquier item falla (stock insuficiente, producto no encontrado,
    zerines insuficientes), TODA la transaccion se aborta y ningun cobro
    se aplica. Esto reemplaza el bucle secuencial del frontend que
    cobraba items ya procesados antes de encontrar un fallo.
    """
    if not data.items:
        raise HTTPException(status_code=400, detail="No items in cart")

    # Load all products in one query.
    product_ids = [item.product_id for item in data.items]
    products_result = await db.execute(
        select(Product).where(Product.id.in_(product_ids))
    )
    products = {p.id: p for p in products_result.scalars().all()}

    # Validate everything before charging.
    total = 0
    results: list[BatchPurchaseResultItem] = []
    for req_item in data.items:
        product = products.get(req_item.product_id)
        qty = req_item.quantity or 1
        if qty < 1:
            raise HTTPException(status_code=400, detail="Quantity must be positive")
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {req_item.product_id} not found")
        if product.requires_specification and not (req_item.specification or "").strip():
            raise HTTPException(
                status_code=400,
                detail=(
                    f"El producto {product.name} requiere una especificacion: "
                    f"{product.specification_placeholder or 'especifica los detalles'}"
                ),
            )
        if product.stock < qty:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {product.name}",
            )
        total += product.price * qty
        results.append(
            BatchPurchaseResultItem(
                product_id=product.id,
                name=product.name,
                quantity=qty,
                price=product.price,
                status="pending",
            )
        )

    if current_user.zerines < total:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient zerines. Need {total}, have {current_user.zerines}",
        )

    # All validated — now charge + decrement stock atomically.
    purchased: list[BatchPurchaseResultItem] = []
    for req_item in data.items:
        product = products[req_item.product_id]
        qty = req_item.quantity or 1
        up_res = await db.execute(
            update(Product)
            .where(Product.id == product.id, Product.stock >= qty)
            .values(
                stock=Product.stock - qty,
                weekly_sales=Product.weekly_sales + qty,
            )
        )
        if up_res.rowcount == 0:
            # Should not happen since we validated above, but guard anyway.
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {product.name}")

        db.add(
            UserProduct(
                user_id=current_user.id,
                product_id=product.id,
                quantity=qty,
                specification=(req_item.specification or "").strip() or None,
            )
        )
        purchased.append(
            BatchPurchaseResultItem(
                product_id=product.id,
                name=product.name,
                quantity=qty,
                price=product.price,
                status="confirmed",
            )
        )

    current_user.zerines -= total
    # Build descriptive transaction description
    shop_names = {}
    for item in purchased:
        shop = products[item.product_id].shop
        if shop not in shop_names:
            shop_names[shop] = []
        shop_names[shop].append(f"{item.name} x{item.quantity}")
    
    if len(shop_names) == 1:
        shop = list(shop_names.keys())[0]
        shop_label = "Flourish & Blotts" if shop == "flourish" else "Borgin & Burkes"
        description = f"Compra en {shop_label}: {', '.join(shop_names[shop])}"
    else:
        parts = []
        for shop, items in shop_names.items():
            shop_label = "Flourish & Blotts" if shop == "flourish" else "Borgin & Burkes"
            parts.append(f"{shop_label}: {', '.join(items)}")
        description = f"Compra batch: {'; '.join(parts)}"
    
    db.add(
        Transaction(
            sender_id=current_user.id,
            amount=total,
            type="purchase",
            description=description,
            status="confirmed",
        )
    )
    await db.commit()
    return BatchPurchaseResponse(
        success=True,
        purchased=purchased,
        total_spent=total,
        new_balance=current_user.zerines,
    )


@router.get("/my-purchases", response_model=Page[UserProductResponse])
async def my_purchases(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserProduct)
        .where(UserProduct.user_id == current_user.id)
        .order_by(UserProduct.purchased_at.desc())
        .offset(skip)
        .limit(limit + 1)
    )
    items = result.scalars().all()
    has_more = len(items) > limit
    items = items[:limit]
    total_result = await db.execute(
        select(func.count(UserProduct.id)).where(
            UserProduct.user_id == current_user.id
        )
    )
    total = total_result.scalar_one()
    return Page(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
        has_more=has_more,
    )


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product
