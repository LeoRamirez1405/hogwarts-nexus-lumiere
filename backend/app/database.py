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
        ("user_conversation_preferences", "last_message_id", "VARCHAR"),
        ("user_conversation_preferences", "last_message_body", "TEXT"),
        ("user_conversation_preferences", "last_message_at", "DATETIME"),
        ("user_conversation_preferences", "last_message_sender_id", "VARCHAR"),
        ("user_conversation_preferences", "unread_count", "INTEGER NOT NULL DEFAULT 0"),
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
    ("messages", ["room_id", "created_at"]),
    ("messages", ["sender_id", "receiver_id", "created_at"]),
    ("messages", ["room_id", "read"]),
    ("messages", ["pinned"]),
    ("message_reactions", ["message_id"]),
    ("chat_room_members", ["room_id"]),
    ("chat_room_members", ["user_id"]),
    ("notifications", ["user_id"]),
    ("notifications", ["user_id", "read"]),
    ("notifications", ["user_id", "created_at"]),
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
    ("user_creatures", ["creature_id"]),
    ("user_creatures", ["for_sale"]),
    ("user_pet_items", ["user_id"]),
    ("user_products", ["user_id"]),
    ("users", ["house"]),
    ("users", ["name"]),
    ("products", ["shop", "category"]),
]

# Partial indexes: only rows matching the predicate are indexed, so the "unread"
# counter queries (`WHERE read = false`) and pinned lookups (`WHERE pinned = true`)
# skip the long tail of already-read / unpinned rows. The doc (3.5) required these
# explicitly; plain composite indexes over a boolean column are nearly useless when
# one branch is the overwhelming majority.
# Entries: (table, cols, predicate_col, expected_value_is_true, idx_name)
_WANTED_PARTIAL_INDEXES = [
    ("messages", ["room_id"], "read", False, "ix_messages_room_id_unread"),
    ("messages", ["receiver_id"], "read", False, "ix_messages_receiver_id_unread"),
    ("messages", ["sender_id", "receiver_id"], "read", False, "ix_messages_sender_receiver_unread"),
    ("messages", ["pinned"], "pinned", True, "ix_messages_pinned_true"),
]


# Full-Text Search: GIN index on search_vector + trigger to auto-update it
# Only runs on PostgreSQL (SQLite doesn't support TSVECTOR)
_FTS_SETUP_SQL = """
CREATE INDEX IF NOT EXISTS ix_messages_search_vector ON messages USING GIN (search_vector);

CREATE OR REPLACE FUNCTION messages_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.body, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.attachment_name, '')), 'B');
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_search_vector_trigger ON messages;
CREATE TRIGGER messages_search_vector_trigger
BEFORE INSERT OR UPDATE ON messages
FOR EACH ROW EXECUTE FUNCTION messages_search_vector_update();
"""


def _ensure_fts(sync_conn):
    """Create FTS index and trigger on PostgreSQL."""
    if sync_conn.dialect.name != "postgresql":
        return
    from sqlalchemy import text
    sync_conn.execute(text(_FTS_SETUP_SQL))


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

    # SQLite stores booleans as 0/1; Postgres uses TRUE/FALSE.
    is_postgres = sync_conn.dialect.name == "postgresql"
    for table, cols, pred_col, is_true, idx_name in _WANTED_PARTIAL_INDEXES:
        if table not in existing_tables:
            continue
        table_cols = {c["name"] for c in inspector.get_columns(table)}
        if not all(c in table_cols for c in cols):
            continue
        col_list = ", ".join(f'"{c}"' for c in cols)
        literal = ("TRUE" if is_true else "FALSE") if is_postgres else ("1" if is_true else "0")
        predicate = f"{pred_col} = {literal}"
        sync_conn.execute(
            text(
                f'CREATE INDEX IF NOT EXISTS {idx_name} ON "{table}" ({col_list}) '
                f"WHERE {predicate}"
            )
        )


def _sync_missing_columns(sync_conn):
    """Add any model column that is missing from an already-existing table.

    ``create_all`` never alters existing tables, and ``_run_migrations`` only
    covers a hand-maintained list, so any column added to a model after its
    table was first created would otherwise be absent (Postgres then raises
    ``column ... does not exist``). This reconciles every mapped table against
    its model, adding missing columns idempotently on SQLite and Postgres.

    Columns are added NULLABLE unless a literal default is available, so the
    ALTER never fails on a table that already holds rows.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(sync_conn)
    existing_tables = set(inspector.get_table_names())
    is_postgres = sync_conn.dialect.name == "postgresql"

    def literal_default(col):
        d = col.default
        if d is None or not getattr(d, "is_scalar", False):
            return None
        val = d.arg
        if isinstance(val, bool):
            return "TRUE" if val else "FALSE"
        if isinstance(val, (int, float)):
            return str(val)
        if isinstance(val, str):
            return "'" + val.replace("'", "''") + "'"
        return None

    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            continue
        existing_cols = {c["name"] for c in inspector.get_columns(table.name)}
        for col in table.columns:
            if col.name in existing_cols:
                continue
            try:
                coltype = col.type.compile(dialect=sync_conn.dialect)
            except Exception:
                continue
            ddl = f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {coltype}'
            default = literal_default(col)
            if default is not None:
                if not is_postgres and default in ("TRUE", "FALSE"):
                    default = "1" if default == "TRUE" else "0"
                ddl += f" DEFAULT {default}"
                if not col.nullable:
                    ddl += " NOT NULL"
            sync_conn.execute(text(ddl))


async def init_db():
    """Apply Alembic migrations and ensure performance indexes.

    Schema changes are versioned via Alembic. This also transparently *adopts*
    a pre-Alembic database: a DB whose schema was created by the old
    ``create_all`` path already has every table but was never stamped with a
    revision. Running the baseline migration against it would try to
    ``CREATE TABLE`` over existing tables and crash startup with
    ``relation "..." already exists``. When that state is detected we stamp the
    DB at ``head`` instead and reconcile any missing tables/columns, so an
    existing production database is upgraded in place without data loss.

    ``_ensure_indexes`` and ``_ensure_fts`` remain as idempotent backfills for
    developer-added indexes that are not (yet) reflected in the model metadata.
    """
    from alembic.config import Config
    from alembic import command

    # Locate alembic.ini relative to this project root (backend/).
    import os
    alembic_path = os.path.join(os.path.dirname(__file__), "..", "alembic.ini")
    cfg = Config(alembic_path)

    # Probe the current DB state to choose between a normal upgrade and adopting
    # an existing, never-stamped schema.
    async with engine.begin() as conn:

        def _probe(sync_conn):
            from sqlalchemy import inspect

            tables = set(inspect(sync_conn).get_table_names())
            return ("alembic_version" in tables), ("users" in tables)

        has_version, has_schema = await conn.run_sync(_probe)

    if has_schema and not has_version:
        # Existing schema, never stamped -> adopt it. Mark it at head so Alembic
        # won't recreate existing tables, then add any table/column the models
        # gained since this DB was last synced (idempotent, keeps existing data).
        command.stamp(cfg, "head")
        async with engine.begin() as conn:
            await conn.run_sync(
                lambda sync_conn: Base.metadata.create_all(sync_conn, checkfirst=True)
            )
            await conn.run_sync(_sync_missing_columns)
    else:
        # Fresh DB (build from base) or already-adopted DB (apply pending revs).
        command.upgrade(cfg, "head")

    async with engine.begin() as conn:
        await conn.run_sync(_ensure_indexes)
        await conn.run_sync(_ensure_fts)
