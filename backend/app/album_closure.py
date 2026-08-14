"""Cierre automatico de albumes vencidos.

Loop de background (estilo retention.py): cada pocos minutos marca como
``completed`` los albumes activos cuyo ``ends_at`` ya paso y notifica a todos
los coleccionistas con al menos una figurita (una sola vez, porque el cambio
de estado ocurre en la misma transaccion).
"""

import asyncio
import logging

from sqlalchemy import select

from .database import async_session
from .models.album import Album, AlbumStatus
from .models.collection import UserCard
from .notifications_service import N, notify
from app.utils.dates import utcnow

logger = logging.getLogger("album_closure")

CHECK_INTERVAL_SECONDS = 300


async def notify_album_closed(db, album: Album) -> int:
    """Notifica a todos los usuarios con >= 1 carta del album cerrado."""
    user_ids = (
        (await db.execute(select(UserCard.user_id).where(UserCard.album_id == album.id).distinct()))
        .scalars()
        .all()
    )
    notified = 0
    for user_id in user_ids:
        try:
            await notify(
                db,
                user_id=user_id,
                type=N.ALBUM_CLOSED,
                title="El album ha cerrado",
                body=f"La edicion \"{album.name}\" ya no acepta figuritas nuevas.",
                related_id=album.id,
            )
            notified += 1
        except Exception:
            logger.exception("fallo notificacion de cierre para %s", user_id)
    return notified


async def close_expired_albums() -> int:
    """Marca como completados los albumes vencidos y notifica una sola vez."""
    now = utcnow()
    async with async_session() as db:
        albums = (
            (
                await db.execute(
                    select(Album).where(
                        Album.status == AlbumStatus.ACTIVE.value,
                        Album.ends_at.is_not(None),
                        Album.ends_at < now,
                    )
                )
            )
            .scalars()
            .all()
        )
        if not albums:
            return 0
        for album in albums:
            album.status = AlbumStatus.COMPLETED.value
        await db.commit()
        closed = 0
        for album in albums:
            try:
                closed += await notify_album_closed(db, album)
                await db.commit()
            except Exception:
                logger.exception("fallo notificacion de cierre de %s", album.id)
        return closed


async def album_closure_loop() -> None:
    """Background task: cierra albumes vencidos cada CHECK_INTERVAL_SECONDS."""
    while True:
        try:
            closed = await close_expired_albums()
            if closed:
                logger.info("albumes cerrados por vencimiento: %s", closed)
        except Exception:
            logger.exception("album_closure_loop fallo")
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)