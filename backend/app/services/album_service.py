"""Serializers compartidos de albums/cartas.

Los modelos SQLAlchemy con relaciones lazy="selectin" ya tienen las colecciones
en ``__dict__`` al serializar; un ``**model.__dict__`` junto a un keyword con el
mismo nombre revienta en pydantic ("multiple values"). Aqui se normaliza.
"""

from ..models.album import Album, AlbumCard
from ..schemas.album import (
    AlbumCardResponse,
    AlbumDetailResponse,
    AlbumGalleryItem,
    AlbumResponse,
)

_RELATIONSHIP_KEYS = {"cards", "creator", "album"}


def _dump(instance) -> dict:
    return {
        k: v
        for k, v in instance.__dict__.items()
        if not k.startswith("_") and k not in _RELATIONSHIP_KEYS
    }


def album_card_response(card: AlbumCard) -> AlbumCardResponse:
    return AlbumCardResponse(**_dump(card))


def album_response(album: Album, total_cards: int = 0) -> AlbumResponse:
    return AlbumResponse(**_dump(album), total_cards=total_cards)


def album_detail_response(album: Album) -> AlbumDetailResponse:
    cards = sorted(album.cards, key=lambda c: c.slot_number)
    return AlbumDetailResponse(
        **_dump(album),
        total_cards=len(cards),
        cards=[album_card_response(c) for c in cards],
    )


def album_gallery_item(album: Album, total: int, progress: int, percent: float, duplicates: int) -> AlbumGalleryItem:
    return AlbumGalleryItem(
        **_dump(album),
        total_cards=total,
        progress=progress,
        percent=percent,
        duplicate_count=duplicates,
    )