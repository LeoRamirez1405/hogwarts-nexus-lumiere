"""Descuento de elementos de Borgin & Burkes del inventario del emisor.

Cuando un usuario envía un mensaje que contiene referencias `!(Nombre del
elemento)`, se descuenta 1 copia de su inventario por cada elemento distinto
mencionado. Si no posee el elemento, el mensaje simplemente no descuenta nada
(el frontend lo muestra como texto plano). Solo aplica a mensajes no cifrados,
donde el body es legible.
"""

import re

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...models.product import Product
from ...models.user_product import UserProduct

# `!(Nombre del elemento)` — mismo patrón que el frontend (MentionText.tsx).
ELEMENT_REFERENCE_RE = re.compile(r"!\(([^)]+)\)")


async def deduct_used_elements(
    db: AsyncSession,
    user_id: str,
    body: str | None,
    is_e2e: bool,
) -> None:
    """Descuenta 1 copia por elemento referenciado del inventario del usuario.

    Es idempotente por nombre de elemento: si el mensaje menciona el mismo
    elemento dos veces, se descuenta una sola copia. Si el usuario no posee el
    elemento (o lo escribió a mano sin tenerlo), no se descuenta nada.
    """
    if is_e2e or not body:
        return

    referenced = set(ELEMENT_REFERENCE_RE.findall(body))
    if not referenced:
        return

    for element_name in referenced:
        await _deduct_one(db, user_id, element_name)


async def _deduct_one(db: AsyncSession, user_id: str, element_name: str) -> None:
    result = await db.execute(
        select(UserProduct)
        .join(Product, UserProduct.product_id == Product.id)
        .where(
            and_(
                UserProduct.user_id == user_id,
                Product.shop == "borgin",
                Product.name == element_name,
                UserProduct.quantity > 0,
            )
        )
        .order_by(UserProduct.purchased_at.asc())
        .limit(1)
    )
    owned = result.scalar_one_or_none()
    if owned is None:
        return

    if owned.quantity <= 1:
        await db.delete(owned)
    else:
        owned.quantity -= 1