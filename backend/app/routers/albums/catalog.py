"""Album catalog routes: active album, album detail, and card lists (public to any user)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.album import Album
from ...models.user import User
from ...schemas.album import AlbumDetailResponse
from ...services import album_service, pack_service

router = APIRouter()


@router.get("/active", response_model=AlbumDetailResponse)
async def get_active_album(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    album = await pack_service.active_album(db)
    if album is None:
        raise HTTPException(status_code=404, detail="No hay un album activo")
    return album_service.album_detail_response(album)


@router.get("/{album_id}", response_model=AlbumDetailResponse)
async def get_album(
    album_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    album = (
        await db.execute(select(Album).where(Album.id == album_id))
    ).scalar_one_or_none()
    if album is None:
        raise HTTPException(status_code=404, detail="Album not found")
    return album_service.album_detail_response(album)