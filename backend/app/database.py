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
    engine_kwargs["max_overflow"] = 5
    # Neon (serverless) suspends compute and drops idle connections. pre_ping
    # transparently discards dead connections instead of erroring on first use,
    # and recycle proactively refreshes connections older than 5 minutes.
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300

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


# Foreign-key / lookup columns that are filtered or joined on hot paths.
# Postgres does not auto-index foreign keys, so without these every feed,
# chat, notification and profile query does a full table scan. Created
# idempotently (CREATE INDEX IF NOT EXISTS) so it is safe on every startup
# and on both SQLite (dev) and Postgres (prod).
_WANTED_INDEXES = [
    ("posts", ["author_id"]),
    ("posts", ["created_at"]),
    ("post_likes", ["post_id"]),
    ("post_likes", ["user_id"]),
    ("post_comments", ["post_id"]),
    ("post_reposts", ["post_id"]),
    ("messages", ["room_id"]),
    ("messages", ["sender_id"]),
    ("messages", ["receiver_id"]),
    ("messages", ["created_at"]),
    ("message_reactions", ["message_id"]),
    ("chat_room_members", ["room_id"]),
    ("chat_room_members", ["user_id"]),
    ("notifications", ["user_id"]),
    ("friend_requests", ["sender_id"]),
    ("friend_requests", ["receiver_id"]),
    ("forum_threads", ["author_id"]),
    ("forum_comments", ["thread_id"]),
    ("forum_thread_votes", ["thread_id"]),
    ("article_comments", ["article_id"]),
    ("article_subscriptions", ["user_id"]),
    ("transactions", ["sender_id"]),
    ("transactions", ["receiver_id"]),
    ("user_creatures", ["user_id"]),
    ("user_pet_items", ["user_id"]),
    ("user_products", ["user_id"]),
]


def _ensure_indexes(sync_conn):
    from sqlalchemy import inspect, text

    inspector = inspect(sync_conn)
    existing_tables = set(inspector.get_table_names())
    for table, cols in _WANTED_INDEXES:
        if table not in existing_tables:
            continue
        table_cols = {c["name"] for c in inspector.get_columns(table)}
        if not all(c in table_cols for c in cols):
            continue
        idx_name = f"ix_{table}_{'_'.join(cols)}"
        col_list = ", ".join(f'"{c}"' for c in cols)
        sync_conn.execute(
            text(f'CREATE INDEX IF NOT EXISTS {idx_name} ON "{table}" ({col_list})')
        )


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_run_migrations)
        await conn.run_sync(_ensure_indexes)
