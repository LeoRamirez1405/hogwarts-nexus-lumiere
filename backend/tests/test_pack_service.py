"""Tests del motor de probabilidades del album de figuritas.

Correr desde backend/:
    pytest tests/ -q
"""


import pytest
import pytest_asyncio
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models.album import Album, AlbumCard, AlbumStatus, CardRarity
from app.models.collection import UserCard
from app.models.pack import PackOrigin, PackType, UserPack
from app.models.user import User
from app.services import pack_service


@pytest_asyncio.fixture
async def db():
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session = async_sessionmaker(engine, expire_on_commit=False)()
    yield session
    await session.close()
    await engine.dispose()


async def _make_user(db, name="Harry") -> User:
    user = User(
        name=name,
        email=f"{name.lower()}@test.com",
        password_hash="x",
        role="user",
        zerines=10000,
    )
    db.add(user)
    await db.flush()
    return user


async def _make_album(db) -> Album:
    album = Album(name="Album Test", status=AlbumStatus.ACTIVE.value, created_by="admin")
    db.add(album)
    await db.flush()
    for slot in range(1, 26):
        db.add(
            AlbumCard(
                album_id=album.id,
                slot_number=slot,
                title=f"Carta {slot}",
                rarity=CardRarity.COMMON.value,
            )
        )
    await db.flush()
    return album


async def _make_pack_type(db, num_cards=3, price=50) -> PackType:
    pack_type = PackType(
        name="Sobre Test",
        price_zerines=price,
        num_cards=num_cards,
        rarity_weights='{"common": 100}',
        enabled=True,
    )
    db.add(pack_type)
    await db.flush()
    return pack_type


async def _make_user_pack(db, user, pack_type, album, origin=PackOrigin.PURCHASE.value) -> UserPack:
    pack = pack_service.create_pack(db, user.id, pack_type, album.id, origin=origin)
    await db.flush()
    return pack


async def test_pick_rarity_returns_valid_key():
    weights = {"common": 55, "rare": 25, "ultra_rare": 12, "special": 6, "legendary": 2}
    for _ in range(50):
        rarity = pack_service.pick_rarity(weights)
        assert rarity in weights


async def test_parse_weights_falls_back_to_defaults(db):
    pack_type = await _make_pack_type(db)
    pack_type.rarity_weights = None
    assert pack_service.parse_weights(pack_type) == pack_service.DEFAULT_WEIGHTS


async def test_open_pack_creates_user_cards(db):
    user = await _make_user(db)
    album = await _make_album(db)
    pack_type = await _make_pack_type(db, num_cards=3)
    pack = await _make_user_pack(db, user, pack_type, album)

    results, pity = await pack_service.open_pack(db, user, pack)

    assert len(results) == 3
    assert all(isinstance(card, AlbumCard) for card, _, _ in results)
    rows = (await db.execute(select(UserCard).where(UserCard.user_id == user.id))).scalars().all()
    # Los duplicados estan permitidos por diseno: 1-3 filas, 3 copias en total.
    assert 1 <= len(rows) <= 3
    assert sum(row.quantity for row in rows) == 3
    assert pack.opened is True
    assert pack.result_json is not None
    assert pity == 1  # album solo tiene common: nunca sale legendary


async def test_open_pack_marks_duplicates(monkeypatch, db):
    class _Rng:
        def random(self) -> float:
            return 1.0  # nunca foil

        def choice(self, seq):
            return seq[0]

        def choices(self, population, weights=None, *, k=1):
            return [population[0]]

    monkeypatch.setattr(pack_service, "random", _Rng())

    user = await _make_user(db)
    album = Album(name="Album Test", status=AlbumStatus.ACTIVE.value, created_by="admin")
    db.add(album)
    await db.flush()
    card = AlbumCard(album_id=album.id, slot_number=1, title="Unica", rarity=CardRarity.COMMON.value)
    db.add(card)
    # Segunda carta: evita que la primera apertura complete el album (y limpie).
    db.add(AlbumCard(album_id=album.id, slot_number=2, title="Otra", rarity=CardRarity.COMMON.value))
    await db.flush()
    pack_type = await _make_pack_type(db, num_cards=1)
    pack1 = await _make_user_pack(db, user, pack_type, album)
    await pack_service.open_pack(db, user, pack1)
    pack2 = await _make_user_pack(db, user, pack_type, album)
    results, _ = await pack_service.open_pack(db, user, pack2)

    assert results[0][0].id == card.id
    row = (
        await db.execute(select(UserCard).where(UserCard.user_id == user.id, UserCard.card_id == card.id))
    ).scalar_one()
    assert row.quantity == 2
    assert results[0][1] is False  # repetida


async def test_open_pack_foil_upgrades_existing_card(monkeypatch, db):
    """Foil (1%): si ya tenias la carta normal, la fila se mejora a foil."""
    user = await _make_user(db)
    album = await _make_album(db)
    card = (
        await db.execute(select(AlbumCard).where(AlbumCard.album_id == album.id).limit(1))
    ).scalar_one()
    pack_type = await _make_pack_type(db, num_cards=1)

    class _Rng:
        def random(self) -> float:
            return 0.0  # siempre foil

        def choice(self, seq):
            return seq[0]

        def choices(self, population, weights=None, *, k=1):
            return [population[0]]

    monkeypatch.setattr(pack_service, "random", _Rng())

    pack1 = await _make_user_pack(db, user, pack_type, album)
    results1, _ = await pack_service.open_pack(db, user, pack1)
    assert results1[0][2] is True  # foil
    pack2 = await _make_user_pack(db, user, pack_type, album)
    results2, _ = await pack_service.open_pack(db, user, pack2)

    row = (
        await db.execute(select(UserCard).where(UserCard.user_id == user.id, UserCard.card_id == card.id))
    ).scalar_one()
    assert results2[0][2] is True
    assert row.quantity == 2
    assert row.foil is True


async def test_open_pack_foil_false_by_default(monkeypatch, db):
    user = await _make_user(db)
    album = await _make_album(db)
    pack_type = await _make_pack_type(db, num_cards=1)

    class _Rng:
        def random(self) -> float:
            return 1.0  # nunca foil

        def choice(self, seq):
            return seq[0]

        def choices(self, population, weights=None, *, k=1):
            return [population[0]]

    monkeypatch.setattr(pack_service, "random", _Rng())
    pack = await _make_user_pack(db, user, pack_type, album)
    results, _ = await pack_service.open_pack(db, user, pack)
    assert results[0][2] is False


async def test_open_pack_rejects_twice(db):
    user = await _make_user(db)
    album = await _make_album(db)
    pack_type = await _make_pack_type(db)
    pack = await _make_user_pack(db, user, pack_type, album)
    await pack_service.open_pack(db, user, pack)
    with pytest.raises(ValueError, match="ya fue abierto"):
        await pack_service.open_pack(db, user, pack)


async def test_buy_pack_insufficient_balance(db):
    user = await _make_user(db)
    user.zerines = 10
    await _make_album(db)  # el album activo debe existir para el cobro
    pack_type = await _make_pack_type(db, price=50)
    with pytest.raises(ValueError, match="insuficientes"):
        await pack_service.buy_pack(db, user, pack_type)


async def test_buy_pack_charges_and_creates(db):
    user = await _make_user(db)
    album = await _make_album(db)
    pack_type = await _make_pack_type(db, price=50)
    pack = await pack_service.buy_pack(db, user, pack_type)
    assert user.zerines == 9950
    assert pack.album_id == album.id
    assert pack.origin == PackOrigin.PURCHASE.value
    assert pack.opened is False


async def test_exchange_duplicates(db):
    user = await _make_user(db)
    album = await _make_album(db)
    await _make_pack_type(db)  # el canje crea el sobre mas barato disponible
    card = (
        await db.execute(select(AlbumCard).where(AlbumCard.album_id == album.id).limit(1))
    ).scalar_one()
    dupes = [
        UserCard(user_id=user.id, album_id=album.id, card_id=card.id, quantity=3),
        UserCard(user_id=user.id, album_id=album.id, card_id="c2", quantity=2),
        UserCard(user_id=user.id, album_id=album.id, card_id="c3", quantity=2),
    ]
    db.add_all(dupes)
    await db.flush()

    pack = await pack_service.exchange_duplicates(db, user, [card.id, "c2", "c3"])

    assert pack.origin == PackOrigin.REWARD.value
    row = (
        await db.execute(select(UserCard).where(UserCard.user_id == user.id, UserCard.card_id == card.id))
    ).scalar_one()
    assert row.quantity == 2  # 3 - 1
    assert pack_service.cheapest_pack_type is not None


async def test_exchange_requires_three(db):
    user = await _make_user(db)
    with pytest.raises(ValueError, match="exactamente 3"):
        await pack_service.exchange_duplicates(db, user, ["a", "b"])


async def test_open_pack_forced_rarity(db):
    user = await _make_user(db)
    album = await _make_album(db)
    pack_type = await _make_pack_type(db, num_cards=1)
    pack = pack_service.create_pack(
        db, user.id, pack_type, album.id, origin=PackOrigin.ROULETTE.value, forced_rarity=CardRarity.LEGENDARY.value
    )
    await db.flush()

    results, _ = await pack_service.open_pack(db, user, pack)

    # El album test no tiene legendary: cae al siguiente nivel disponible.
    assert results[0][0].rarity == CardRarity.COMMON.value


async def test_pity_guarantees_legendary(monkeypatch, db):
    user = await _make_user(db)
    album = await _make_album(db)
    db.add(AlbumCard(album_id=album.id, slot_number=26, title="Legendaria", rarity=CardRarity.LEGENDARY.value))
    await db.flush()
    pack_type = await _make_pack_type(db, num_cards=1)
    monkeypatch.setattr(pack_service, "PITY_TARGET", 0)

    pack = await _make_user_pack(db, user, pack_type, album)
    results, pity = await pack_service.open_pack(db, user, pack)

    assert results[0][0].rarity == CardRarity.LEGENDARY.value
    assert pity == 0  # se reinicia


async def test_pity_progress_counts_only_legendary_breaks(db):
    user = await _make_user(db)
    album = await _make_album(db)
    pack_type = await _make_pack_type(db, num_cards=1)
    for _ in range(3):
        pack = await _make_user_pack(db, user, pack_type, album)
        await pack_service.open_pack(db, user, pack)
    assert await pack_service._pity_progress(db, user.id) == 3


async def test_roulette_segment_parsing(db):
    from app.models.roulette import RouletteConfig
    from app.services import roulette_service

    config = RouletteConfig(
        cost_zerines=100,
        segments='[{"prize": "pack:1", "label": "1 Sobre", "weight": 60, "pack_type_id": null},'
        ' {"prize": "zerines:100", "label": "100", "weight": 40}]',
        enabled=True,
    )
    db.add(config)
    await db.flush()
    segments = roulette_service.parse_segments(config)
    assert len(segments) == 2
    assert segments[0].prize == "pack:1"
    assert segments[0].weight == 60


async def _make_tiny_album(db) -> Album:
    """Album de 1 sola carta: abrir un sobre lo completa."""
    album = Album(name="Album Miniatura", status=AlbumStatus.ACTIVE.value, created_by="admin")
    db.add(album)
    await db.flush()
    db.add(
        AlbumCard(album_id=album.id, slot_number=1, title="Unica", rarity=CardRarity.COMMON.value)
    )
    await db.flush()
    return album


async def _complete_album(db, user, album) -> None:
    """Fuerza la coleccion completa (sin disparar la logica de completado)."""
    cards = (
        await db.execute(select(AlbumCard).where(AlbumCard.album_id == album.id))
    ).scalars().all()
    for card in cards:
        db.add(UserCard(user_id=user.id, album_id=album.id, card_id=card.id, quantity=1))
    await db.flush()


async def test_completion_cleans_packs_and_duplicates(db):
    """Al completar: sobres sin abrir borrados, duplicados a quantity=1,
    bote + badge + titulo solo para el primer completador."""
    from app.models.badge import UserBadge

    user = await _make_user(db)
    album = await _make_tiny_album(db)
    pack_type = await _make_pack_type(db, num_cards=1)

    card = (
        await db.execute(select(AlbumCard).where(AlbumCard.album_id == album.id).limit(1))
    ).scalar_one()
    db.add(
        UserCard(
            user_id=user.id, album_id=album.id, card_id=card.id,
            quantity=4, foil=True,
        )
    )
    await db.flush()

    finishing_pack = await _make_user_pack(db, user, pack_type, album)
    await pack_service.open_pack(db, user, finishing_pack)

    assert album.first_completed_by == user.id
    assert user.zerines == 10000 + pack_service.FIRST_COMPLETION_PRIZE
    assert user.official_title == "Primer Completador"
    badge = (
        await db.execute(select(UserBadge).where(UserBadge.user_id == user.id))
    ).scalar_one_or_none()
    assert badge is not None
    assert badge.badge_key == pack_service.FIRST_COMPLETER_BADGE_KEY

    remaining_packs = (
        await db.execute(select(UserPack).where(UserPack.user_id == user.id))
    ).scalars().all()
    assert len(remaining_packs) == 1  # solo el que se acaba de abrir
    assert remaining_packs[0].opened is True

    row = (
        await db.execute(select(UserCard).where(UserCard.user_id == user.id))
    ).scalar_one()
    assert row.quantity == 1
    assert row.foil is True  # la limpieza no toca la variante foil


async def test_second_completer_cleans_without_prize(db):
    """El 2do, 3ro... tambien pierden sobres/duplicados pero sin bote ni badge."""
    from app.models.badge import UserBadge

    first = await _make_user(db, "Luna")
    second = await _make_user(db, "Neville")
    album = await _make_tiny_album(db)
    pack_type = await _make_pack_type(db, num_cards=1)

    pack1 = await _make_user_pack(db, first, pack_type, album)
    await pack_service.open_pack(db, first, pack1)

    pack2 = await _make_user_pack(db, second, pack_type, album)
    await pack_service.open_pack(db, second, pack2)

    assert album.first_completed_by == first.id
    assert second.zerines == 10000
    badge = (
        await db.execute(select(UserBadge).where(UserBadge.user_id == second.id))
    ).scalar_one_or_none()
    assert badge is None
    rows = (
        await db.execute(select(UserCard).where(UserCard.user_id == second.id))
    ).scalars().all()
    assert all(row.quantity == 1 for row in rows)


async def test_completion_records_xp_for_every_completer(db):
    """Cada completador (primero y posteriores) deja UserAlbumCompletion,
    que alimenta el XP del nivel magico (100 por album)."""
    from app.models.collection import UserAlbumCompletion
    from app.utils.magic_level import get_magic_level

    first = await _make_user(db, "Luna")
    second = await _make_user(db, "Neville")
    album = await _make_tiny_album(db)
    pack_type = await _make_pack_type(db, num_cards=1)

    pack1 = await _make_user_pack(db, first, pack_type, album)
    await pack_service.open_pack(db, first, pack1)
    pack2 = await _make_user_pack(db, second, pack_type, album)
    await pack_service.open_pack(db, second, pack2)

    completions = (
        await db.execute(select(UserAlbumCompletion).order_by(UserAlbumCompletion.user_id))
    ).scalars().all()
    assert len(completions) == 2
    assert {c.user_id for c in completions} == {first.id, second.id}
    assert all(c.album_id == album.id for c in completions)

    level_first = await get_magic_level(db, first)
    level_second = await get_magic_level(db, second)
    assert level_first["xp"] == 100
    assert level_second["xp"] == 100

    # Idempotente: re-correr el completado no duplica el registro.
    await pack_service._handle_completion(db, album.id, first.id)
    rows = (
        await db.execute(
            select(UserAlbumCompletion).where(UserAlbumCompletion.user_id == first.id)
        )
    ).scalars().all()
    assert len(rows) == 1


async def test_buy_blocked_after_completion(db):
    user = await _make_user(db)
    album = await _make_album(db)
    pack_type = await _make_pack_type(db, price=50)
    await _complete_album(db, user, album)
    with pytest.raises(ValueError, match="Ya completaste"):
        await pack_service.buy_pack(db, user, pack_type)
    assert user.zerines == 10000  # nunca se cobro


async def test_exchange_blocked_after_completion(db):
    user = await _make_user(db)
    album = await _make_album(db)
    await _complete_album(db, user, album)
    with pytest.raises(ValueError, match="Ya completaste"):
        await pack_service.exchange_duplicates(db, user, ["a", "b", "c"])


async def test_roulette_blocked_for_completed_user(db):
    from app.models.roulette import RouletteConfig
    from app.services import roulette_service

    user = await _make_user(db)
    album = await _make_album(db)
    await _complete_album(db, user, album)
    config = RouletteConfig(
        cost_zerines=100,
        segments='[{"prize": "zerines:100", "label": "100", "weight": 1}]',
        enabled=True,
    )
    db.add(config)
    await db.flush()
    with pytest.raises(ValueError, match="Ya completaste"):
        await roulette_service.spin(db, user, config)
    assert user.zerines == 10000  # el giro no se cobro


async def _make_roulette(db, segments: str, cost: int = 100):
    from app.models.roulette import RouletteConfig

    config = RouletteConfig(
        cost_zerines=cost,
        segments=segments,
        enabled=True,
    )
    db.add(config)
    await db.flush()
    return config


async def test_roulette_none_prize_charges_and_gives_nothing(db):
    from app.models.transaction import Transaction
    from app.services import roulette_service

    user = await _make_user(db)
    await _make_album(db)
    config = await _make_roulette(db, '[{"prize": "none", "label": "Buen intento", "weight": 1}]')
    spin_row, packs, zerines, xp_won, free_spins = await roulette_service.spin(db, user, config)
    assert user.zerines == 9900  # se cobro el giro
    assert spin_row.cost == 100
    assert packs == []
    assert zerines == 0 and xp_won == 0 and free_spins == 0
    tx_count = (
        await db.execute(
            select(func.count()).select_from(Transaction).where(Transaction.sender_id == user.id)
        )
    ).scalar_one()
    assert tx_count == 1  # solo el cobro, sin deposito


async def test_roulette_xp_prize_counts_in_batch_xp(db):
    from app.services import roulette_service
    from app.utils.magic_level import _batch_xp

    user = await _make_user(db)
    await _make_album(db)
    config = await _make_roulette(db, '[{"prize": "xp:50", "label": "50 XP", "weight": 1}]')
    spin_row, _, _, xp_won, _ = await roulette_service.spin(db, user, config)
    assert xp_won == 50
    assert spin_row.cost == 100

    baseline = await _make_user(db, name="Ron")
    await _make_album(db)
    config_baseline = await _make_roulette(db, '[{"prize": "none", "label": "Nada", "weight": 1}]')
    await roulette_service.spin(db, baseline, config_baseline)

    xp_map = await _batch_xp(db, [user.id, baseline.id])
    assert xp_map[baseline.id] == 5  # solo el cobro del giro (buy_product)
    assert xp_map[user.id] == xp_map[baseline.id] + 50  # el premio XP suma 50


async def test_roulette_spins_prize_grants_free_spins(db):
    from app.services import roulette_service

    user = await _make_user(db)
    await _make_album(db)
    config = await _make_roulette(db, '[{"prize": "spins:2", "label": "2 giros", "weight": 1}]')
    _, _, _, _, free_spins = await roulette_service.spin(db, user, config)
    assert free_spins == 2
    assert user.free_spins == 2


async def test_roulette_free_spin_consumed_before_zerines(db):
    from app.models.transaction import Transaction
    from app.services import roulette_service

    user = await _make_user(db)
    user.free_spins = 1
    await _make_album(db)
    config = await _make_roulette(db, '[{"prize": "none", "label": "Nada", "weight": 1}]')
    spin_row, _, _, _, _ = await roulette_service.spin(db, user, config)
    assert user.free_spins == 0  # se consumo el giro gratis
    assert user.zerines == 10000  # no se cobro
    assert spin_row.cost == 0
    tx_count = (
        await db.execute(
            select(func.count()).select_from(Transaction).where(Transaction.sender_id == user.id)
        )
    ).scalar_one()
    assert tx_count == 0


async def test_roulette_unknown_prize_rejected_without_charge(db):
    from app.services import roulette_service

    user = await _make_user(db)
    await _make_album(db)
    config = await _make_roulette(db, '[{"prize": "doggo", "label": "?", "weight": 1}]')
    with pytest.raises(ValueError, match="desconocido"):
        await roulette_service.spin(db, user, config)
    assert user.zerines == 10000  # no se cobro


async def test_is_completed_false_when_album_empty(db):
    user = await _make_user(db)
    album = await _make_album(db)
    assert await pack_service.is_completed(db, album.id, user.id) is False