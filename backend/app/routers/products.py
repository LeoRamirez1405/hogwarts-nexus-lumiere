from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..database import get_db
from ..models.product import Product
from ..models.user import User
from ..models.transaction import Transaction
from ..schemas.product import ProductCreate, ProductUpdate, ProductResponse
from ..middleware.auth import get_current_user
from ..middleware.roles import require_role

router = APIRouter()


@router.get("/", response_model=List[ProductResponse])
async def list_products(
    shop: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Product)
    if shop:
        query = query.where(Product.shop == shop)
    query = query.order_by(Product.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


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
    quantity: int = 1,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.stock < quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")

    total = product.price * quantity
    if current_user.zerines < total:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient zerines. Need {total}, have {current_user.zerines}",
        )

    current_user.zerines -= total
    product.stock -= quantity
    product.weekly_sales += quantity

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


@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    product_data: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    product = Product(**product_data.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: str,
    update_data: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    for key, value in update_data.model_dump(exclude_unset=True).items():
        setattr(product, key, value)

    await db.commit()
    await db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    await db.delete(product)
    await db.commit()
