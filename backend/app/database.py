from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from .config import settings


def _extract_token(url: str) -> tuple[str, str]:
    """Return (clean_url, auth_token) extracted from a libsql URL, if present."""
    token = ""
    if "+libsql" in url and "auth_token=" in url:
        from urllib.parse import urlparse, urlunparse, parse_qs
        parsed = urlparse(url)
        qs = parse_qs(parsed.query, keep_blank_values=True)
        token = qs.pop("auth_token", [""])[0]
        clean_query = "&".join(f"{k}={v[0]}" for k, v in qs.items())
        url = urlunparse(parsed._replace(query=clean_query))
    return url, token


def get_database_url():
    """Construct database URL based on available configuration.

    Normalises any of:
      - libsql://host?auth_token=...         -> sqlite+libsql://host (token via connect_args)
      - sqlite+libsql://host?auth_token=...  -> unchanged (token via connect_args)
      - sqlite+aiosqlite:///./nexus.db       -> unchanged
    """
    url = settings.DATABASE_URL or ""

    if settings.TURSO_DATABASE_URL and settings.TURSO_AUTH_TOKEN:
        host = settings.TURSO_DATABASE_URL
        if host.startswith("libsql://"):
            host = host[len("libsql://"):]
        if host.startswith("sqlite+libsql://"):
            host = host[len("sqlite+libsql://"):]
        return f"sqlite+libsql://{host}?secure=true"

    if url.startswith("libsql://"):
        url = "sqlite+libsql://" + url[len("libsql://"):]

    url, _ = _extract_token(url)
    return url


def get_connect_args():
    db_url = get_database_url()
    args = {}
    if "sqlite" in db_url and "+libsql" not in db_url:
        args["check_same_thread"] = False

    token = settings.TURSO_AUTH_TOKEN
    if not token:
        raw = settings.DATABASE_URL or ""
        if raw.startswith("libsql://"):
            raw = "sqlite+libsql://" + raw[len("libsql://"):]
        _, token = _extract_token(raw)
    if token:
        args["auth_token"] = token
    return args


database_url = get_database_url()

engine_kwargs = {
    "echo": False,
    "connect_args": get_connect_args(),
}
# QueuePool-only options (pool_size / max_overflow) are invalid for SQLite/libsql,
# which use SingletonThreadPool. Only apply them for real pooled backends.
if "sqlite" not in database_url:
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
