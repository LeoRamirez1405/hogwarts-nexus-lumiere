"""Album gallery routes: list albums with the viewer's own progress."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.album import Album
from ...models.user import User
from ...schemas.album import AlbumGalleryItem
from ...services import album_service
from .collection import collection_for

router = APIRouter()


@router.get("", response_model=list[AlbumGalleryItem])
async def list_albums_gallery(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Galeria: todos los albums (actuales y pasados) con % de completado del usuario."""
    albums = (
        await db.execute(select(Album).order_by(Album.starts_at.desc()))
    ).scalars().all()
    result = []
    for album in albums:
        collection = await collection_for(db, current_user.id, album)
        result.append(
            album_service.album_gallery_item(
                album,
                total=collection.total,
                progress=collection.progress,
                percent=collection.percent,
                duplicates=collection.duplicate_count,
            )
        )
    return result