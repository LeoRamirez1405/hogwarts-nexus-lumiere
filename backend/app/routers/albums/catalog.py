"""Album catalog routes: active album, album detail, and card lists (public to any user)."""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...cache import cache_get, cache_set
from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.album import Album
from ...models.user import User
from ...schemas.album import AlbumDetailResponse
from ...services import album_service, pack_service

router = APIRouter()

_ALBUM_TTL = 300


@router.get("/active", response_model=AlbumDetailResponse)
async def get_active_album(
    response: Response,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    cache_key = "albums:active"
    cached = cache_get(cache_key)
    if cached is not None:
        response.headers["Cache-Control"] = f"private, max-age={_ALBUM_TTL}"
        return cached
    album = await pack_service.active_album(db)
    if album is None:
        raise HTTPException(status_code=404, detail="No hay un album activo")
    payload = album_service.album_detail_response(album)
    cache_set(cache_key, payload, _ALBUM_TTL)
    response.headers["Cache-Control"] = f"private, max-age={_ALBUM_TTL}"
    return payload


@router.get("/{album_id}", response_model=AlbumDetailResponse)
async def get_album(
    album_id: str,
    response: Response,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    cache_key = f"albums:{album_id}"
    cached = cache_get(cache_key)
    if cached is not None:
        response.headers["Cache-Control"] = f"private, max-age={_ALBUM_TTL}"
        return cached
    album = (
        await db.execute(select(Album).where(Album.id == album_id))
    ).scalar_one_or_none()
    if album is None:
        raise HTTPException(status_code=404, detail="Album not found")
    payload = album_service.album_detail_response(album)
    cache_set(cache_key, payload, _ALBUM_TTL)
    response.headers["Cache-Control"] = f"private, max-age={_ALBUM_TTL}"
    return payload