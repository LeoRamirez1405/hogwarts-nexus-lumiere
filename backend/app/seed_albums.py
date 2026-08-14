"""Seed script for the demo sticker album, pack types, and roulette config."""

import asyncio
import json
import random
from datetime import timedelta

from sqlalchemy import select

from .database import async_session
from .models.user import User
from .models.album import Album, AlbumCard, AlbumStatus, CardRarity
from .models.pack import PackType
from .models.roulette import RouletteConfig
from app.utils.dates import utcnow

# Distribucion de rarezas para los 25 slots del album demo.
# Se baraja al crear el album: cada slot recibe una rareza aleatoria de esta
# lista, asi la #25 no es siempre legendaria ni las primeras siempre comunes.
SLOT_RARITIES = [
    *[CardRarity.COMMON.value] * 14,
    *[CardRarity.RARE.value] * 5,
    *[CardRarity.ULTRA_RARE.value] * 3,
    *[CardRarity.SPECIAL.value] * 2,
    CardRarity.LEGENDARY.value,
]

DEFAULT_PACK_TYPES = [
    {
        "name": "Sobre de Lechuza",
        "description": "5 cartas con probabilidades estandar.",
        "price_zerines": 50,
        "num_cards": 5,
        "rarity_weights": {"common": 55, "rare": 25, "ultra_rare": 12, "special": 6, "legendary": 2},
    },
    {
        "name": "Sobre de Hipogrifo",
        "description": "3 cartas con probabilidades mejoradas.",
        "price_zerines": 150,
        "num_cards": 3,
        "rarity_weights": {"common": 35, "rare": 35, "ultra_rare": 18, "special": 9, "legendary": 3},
    },
    {
        "name": "Sobre de Dragón",
        "description": "1 carta con rareza alta casi garantizada.",
        "price_zerines": 300,
        "num_cards": 1,
        "rarity_weights": {"common": 0, "rare": 15, "ultra_rare": 35, "special": 30, "legendary": 20},
    },
]

ROULETTE_SEGMENTS = [
    {"prize": "pack:1", "pack_type": "basic", "label": "1 Sobre de Lechuza", "weight": 35},
    {"prize": "pack:2", "pack_type": "basic", "label": "2 Sobres de Lechuza", "weight": 18},
    {"prize": "pack:1", "pack_type": "hippogriff", "label": "Sobre de Hipogrifo", "weight": 15},
    {"prize": "zerines:100", "label": "100 Zerines", "weight": 22},
    {"prize": "pack:5", "pack_type": "basic", "label": "JACKPOT: 5 Sobres", "weight": 5},
    {"prize": "legendary", "pack_type": "basic", "label": "JACKPOT: Legendaria Garantizada", "weight": 5},
]


async def seed_albums():
    """Create a demo album with 25 generic slots, pack types and roulette config.

    Idempotent: skips if an album already exists. Images are uploaded later by
    an admin from /admin/albums (image_url starts as None).
    """
    async with async_session() as db:
        existing = await db.execute(select(Album).limit(1))
        if existing.scalar_one_or_none():
            print("Album already seeded, skipping...")
            return

        admin = (await db.execute(select(User).where(User.role == "admin").limit(1))).scalar_one_or_none()
        if admin is None:
            print("No admin user found; run seed.py first.")
            return

        now = utcnow()
        album = Album(
            name="Album Demo - Edicion 1",
            description="Album de figuritas de prueba. El admin puede subir las 25 imagenes desde /admin/albums.",
            cover_url=None,
            status=AlbumStatus.ACTIVE.value,
            starts_at=now,
            ends_at=now + timedelta(weeks=2),
            created_by=admin.id,
        )
        db.add(album)
        await db.flush()

        for slot, rarity in enumerate(random.sample(SLOT_RARITIES, len(SLOT_RARITIES)), start=1):
            db.add(
                AlbumCard(
                    album_id=album.id,
                    slot_number=slot,
                    title=f"Figurita {slot}",
                    # Fotos de prueba de picsum (CSP ya permite picsum + fastly).
                    # El admin puede reemplazarlas subiendo las suyas en /admin/albums.
                    image_url=f"https://picsum.photos/seed/album-demo-{slot}/300/400",
                    rarity=rarity,
                )
            )

        existing_types = {
            pt.name for pt in (await db.execute(select(PackType))).scalars().all()
        }
        for data in DEFAULT_PACK_TYPES:
            if data["name"] in existing_types:
                continue
            db.add(
                PackType(
                    name=data["name"],
                    description=data["description"],
                    price_zerines=data["price_zerines"],
                    num_cards=data["num_cards"],
                    rarity_weights=json.dumps(data["rarity_weights"]),
                    enabled=True,
                )
            )
        await db.flush()

        pack_types = (await db.execute(select(PackType))).scalars().all()
        by_name = {pt.name: pt.id for pt in pack_types}

        segments = []
        for segment in ROULETTE_SEGMENTS:
            data = dict(segment)
            key = data.pop("pack_type", None)
            if key == "basic":
                data["pack_type_id"] = by_name.get("Sobre de Lechuza")
            elif key == "hippogriff":
                data["pack_type_id"] = by_name.get("Sobre de Hipogrifo")
            segments.append(data)

        existing_roulette = (
            await db.execute(select(RouletteConfig).limit(1))
        ).scalar_one_or_none()
        if existing_roulette is None:
            db.add(
                RouletteConfig(
                    cost_zerines=100,
                    segments=json.dumps(segments),
                    enabled=True,
                    updated_by=admin.id,
                )
            )

        await db.commit()
        print("Album demo + 3 pack types + ruleta creados.")


if __name__ == "__main__":
    asyncio.run(seed_albums())
