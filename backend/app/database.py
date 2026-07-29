import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from .config import settings

def get_database_url():
    """Construct database URL based on available configuration."""
    # If TURSO variables are set, use them to construct Turso URL
    if settings.TURSO_DATABASE_URL and settings.TURSO_AUTH_TOKEN:
        # Format: sqlite+libsql://<database-url>?auth_token=<token>
        return f"sqlite+libsql://{settings.TURSO_DATABASE_URL}?auth_token={settings.TURSO_AUTH_TOKEN}"
    
    # Otherwise use the main DATABASE_URL (could be local SQLite or already full Turso URL)
    return settings.DATABASE_URL

# Create async engine with connection pooling limits
database_url = get_database_url()
engine = create_async_engine(
    database_url,
    echo=False,
    # Connection pool settings to prevent too many connections
    # max_overflow=0 means no extra connections beyond pool_size
    # pool_size=10 means max 10 concurrent connections
    pool_size=10,
    max_overflow=0,
    # Additional connect args for libsql
    connect_args={"check_same_thread": False} if "sqlite" in database_url else {}
)

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
