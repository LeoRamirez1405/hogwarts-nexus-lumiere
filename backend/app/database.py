from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from .config import settings


def _prepare_url(raw: str) -> tuple[str, bool]:
    """Return (async_sqlalchemy_url, ssl_required).

      - postgres://... / postgresql://...  -> postgresql+asyncpg://...
      - sqlite+aiosqlite:///./nexus.db     -> unchanged (local dev)

    Hosted Postgres (Neon, Supabase, Render, …) is rewritten to the async
    ``asyncpg`` driver. asyncpg does not understand libpq query params such
    as ``sslmode``; those are stripped, and ``sslmode`` is translated into an
    ``ssl=True`` connect arg (Neon/Supabase require TLS).
    """
    url = raw or "sqlite+aiosqlite:///./nexus.db"

    if url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]

    ssl_required = False
    if url.startswith("postgresql+asyncpg://"):
        from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
        parsed = urlparse(url)
        params = dict(parse_qsl(parsed.query))
        sslmode = params.pop("sslmode", None)
        params.pop("channel_binding", None)
        params.pop("target_session_attrs", None)
        # Any sslmode other than explicit "disable" means TLS is expected.
        ssl_required = sslmode is not None and sslmode != "disable"
        url = urlunparse(parsed._replace(query=urlencode(params)))

    return url, ssl_required


def get_database_url():
    url, _ = _prepare_url(settings.DATABASE_URL)
    return url


def get_connect_args():
    db_url, ssl_required = _prepare_url(settings.DATABASE_URL)
    args = {}
    if db_url.startswith("sqlite"):
        args["check_same_thread"] = False
    elif ssl_required:
        args["ssl"] = True
    return args


database_url = get_database_url()

engine_kwargs = {
    "echo": False,
    "connect_args": get_connect_args(),
}
# pool_size / max_overflow only apply to real pooled backends (Postgres).
# SQLite uses SingletonThreadPool, which rejects those options.
if not database_url.startswith("sqlite"):
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 0

engine = create_async_engine(database_url, **engine_kwargs)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        yield session


def _run_migrations(sync_conn):
    """Lightweight additive migrations for SQLite.
    
    `create_all` only creates missing tables; it never adds columns to an
    existing table. Any column added to a model after its table already
    exists must be backfilled here with ADD COLUMN.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(sync_conn)
    existing_tables = set(inspector.get_table_names())

    # (table, column, DDL type + default) tuples to ensure.
    wanted = [
        ("messages", "pinned", "BOOLEAN NOT NULL DEFAULT 0"),
        ("chat_room_members", "last_read_at", "DATETIME"),
        ("creatures", "pet_type", "VARCHAR(40) NOT NULL DEFAULT 'Criaturas pequeñas'"),
        ("creatures", "required_user_level", "INTEGER NOT NULL DEFAULT 1"),
        ("creatures", "required_sanctuary_level", "INTEGER NOT NULL DEFAULT 0"),
        ("user_creatures", "last_decay_at", "DATETIME"),
        ("user_creatures", "farewell_warned", "BOOLEAN NOT NULL DEFAULT 0"),
        ("user_creatures", "for_sale", "BOOLEAN NOT NULL DEFAULT 0"),
        ("user_creatures", "sale_price", "INTEGER"),
        ("users", "house_points", "INTEGER NOT NULL DEFAULT 0"),
        ("users", "care_actions", "INTEGER NOT NULL DEFAULT 0"),
        ("users", "items_purchased", "INTEGER NOT NULL DEFAULT 0"),
        ("users", "sanctuary_penalty", "INTEGER NOT NULL DEFAULT 0"),
        ("users", "status", "VARCHAR(80)"),
        ("users", "wand", "VARCHAR(200)"),
        ("users", "location", "VARCHAR(100)"),
        ("users", "official_title", "VARCHAR(100)"),
        ("users", "last_active_at", "DATETIME"),
        ("notifications", "actor_id", "VARCHAR"),
        ("user_creatures", "attention_warned", "BOOLEAN NOT NULL DEFAULT 0"),
    ]
    for table, column, ddl in wanted:
        if table not in existing_tables:
            continue
        cols = {c["name"] for c in inspector.get_columns(table)}
        if column not in cols:
            sync_conn.execute(
                text(f'ALTER TABLE "{table}" ADD COLUMN {column} {ddl}')
            )


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_run_migrations)
