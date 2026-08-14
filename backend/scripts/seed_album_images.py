"""Assign demo images + titles to the active album's 25 cards and grant test packs.

Run from the backend directory:

    python scripts/seed_album_images.py [--email user@nexus.com]

- Sets a deterministic picsum.photos URL (already allowed by the frontend CSP
  and next/image remotePatterns) plus a themed title for every card.
- Creates one unopened UserPack per rarity (forced_rarity) for the given user
  (default: harry@nexus.com) so each rarity reveal animation can be tested.

Idempotent: re-running only re-assigns images/titles and appends packs.
"""

import argparse
import asyncio
import sys
from pathlib import Path

from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import async_session
from app.models.album import Album, AlbumCard, AlbumStatus, CardRarity
from app.models.pack import PackType, PackOrigin
from app.models.user import User
from app.services.pack_service import create_pack

# Slot -> (title, rarity). Mirrors the demo rarity distribution.
CARDS = [
    (1, "Harry Potter", CardRarity.COMMON.value),
    (2, "Ron Weasley", CardRarity.COMMON.value),
    (3, "Hermione Granger", CardRarity.COMMON.value),
    (4, "Neville Longbottom", CardRarity.COMMON.value),
    (5, "Draco Malfoy", CardRarity.COMMON.value),
    (6, "Luna Lovegood", CardRarity.COMMON.value),
    (7, "Ginny Weasley", CardRarity.COMMON.value),
    (8, "Fred Weasley", CardRarity.COMMON.value),
    (9, "George Weasley", CardRarity.COMMON.value),
    (10, "Cho Chang", CardRarity.COMMON.value),
    (11, "Lavender Brown", CardRarity.COMMON.value),
    (12, "Seamus Finnigan", CardRarity.COMMON.value),
    (13, "Dean Thomas", CardRarity.COMMON.value),
    (14, "Hedwig", CardRarity.COMMON.value),
    (15, "Minerva McGonagall", CardRarity.RARE.value),
    (16, "Severus Snape", CardRarity.RARE.value),
    (17, "Remus Lupin", CardRarity.RARE.value),
    (18, "Sirius Black", CardRarity.RARE.value),
    (19, "Rubeus Hagrid", CardRarity.RARE.value),
    (20, "Albus Dumbledore", CardRarity.ULTRA_RARE.value),
    (21, "Nymphadora Tonks", CardRarity.ULTRA_RARE.value),
    (22, "Bellatrix Lestrange", CardRarity.ULTRA_RARE.value),
    (23, "Lord Voldemort", CardRarity.SPECIAL.value),
    (24, "Fawkes", CardRarity.SPECIAL.value),
    (25, "La Varita de Sauco", CardRarity.LEGENDARY.value),
]

# Each rarity gets a dedicated test pack (first card is forced).
TEST_PACKS = [
    (CardRarity.COMMON.value, "Sobre de Lechuza"),
    (CardRarity.RARE.value, "Sobre de Lechuza"),
    (CardRarity.ULTRA_RARE.value, "Sobre de Hipogrifo"),
    (CardRarity.SPECIAL.value, "Sobre de Dragon"),
    (CardRarity.LEGENDARY.value, "Sobre de Dragon"),
]


async def run(email: str) -> None:
    async with async_session() as db:
        album = (
            await db.execute(
                select(Album).where(Album.status == AlbumStatus.ACTIVE.value).order_by(Album.starts_at.desc()).limit(1)
            )
        ).scalar_one_or_none()
        if album is None:
            print("No active album found; run app/seed_albums.py first.")
            return

        cards = (await db.execute(select(AlbumCard).where(AlbumCard.album_id == album.id))).scalars().all()
        by_slot = {c.slot_number: c for c in cards}

        for slot, title, _rarity in CARDS:
            card = by_slot.get(slot)
            if card is None:
                print(f"SKIP: slot {slot} missing from album")
                continue
            card.title = title
            card.image_url = f"https://picsum.photos/seed/nexus-album-{album.id[:8]}-{slot}/400/560"

        user = (
            await db.execute(select(User).where(User.email == email).limit(1))
        ).scalar_one_or_none()
        if user is None:
            await db.commit()
            print(f"Images assigned to {album.name}. User {email} not found, skipping test packs.")
            return

        pack_types = (await db.execute(select(PackType))).scalars().all()
        by_name = {pt.name: pt.id for pt in pack_types}

        created = []
        for rarity, pack_name in TEST_PACKS:
            pack_type_id = by_name.get(pack_name)
            if pack_type_id is None:
                print(f"SKIP: pack type '{pack_name}' missing")
                continue
            pack_type = next(pt for pt in pack_types if pt.id == pack_type_id)
            create_pack(
                db,
                user.id,
                pack_type,
                album.id,
                origin=PackOrigin.REWARD.value,
                forced_rarity=rarity,
            )
            created.append(rarity)

        await db.commit()
        print(f"Assigned images to {len(CARDS)} cards of '{album.name}'.")
        print(f"Granted test packs to {user.email}: {', '.join(created)}")
        print("Open them at /album/abrir to preview every rarity animation.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed album images + rarity test packs")
    parser.add_argument("--email", default="harry@nexus.com", help="User to grant test packs to")
    args = parser.parse_args()
    asyncio.run(run(args.email))