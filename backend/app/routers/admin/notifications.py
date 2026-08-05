"""Admin-only notification routes (prefix /admin/notifications)."""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.roles import require_role
from ...models.article_subscription import Notification
from ...models.user import User
from ...schemas.article import NotificationResponse

router = APIRouter(prefix="/admin/notifications", tags=["admin-notifications"])


@router.post("/test", response_model=List[NotificationResponse])
async def create_test_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Create a handful of sample notifications for EVERY user.

    Development/testing helper so the notification bell can be verified
    without having to trigger real events (articles, likes, mentions…).
    Admin-only; safe to call repeatedly (samples accumulate).
    """
    samples = [
        ("article_created", "Nuevo artículo publicado", "El Quisquilloso publicó 'El arte de la poción perfecta'"),
        ("post_like", "A alguien le gustó tu publicación", "Hermione Granger reaccionó a tu publicación"),
        ("mention", "Te mencionaron", "Luna Lovegood te mencionó en un comentario"),
        ("friend_request", "Nueva solicitud de amistad", "Cedric Diggory quiere ser tu amigo"),
        ("dm_message", "Nuevo mensaje", "Tienes un mensaje sin leer en tu bandeja"),
    ]
    user_ids = (await db.execute(select(User.id))).scalars().all()
    created = []
    for uid in user_ids:
        for ntype, title, body in samples:
            n = Notification(
                user_id=uid,
                type=ntype,
                title=title,
                body=body,
            )
            db.add(n)
            created.append(n)
    await db.commit()
    for n in created:
        await db.refresh(n)
    return created
