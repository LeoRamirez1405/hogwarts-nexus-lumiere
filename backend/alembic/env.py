"""
Alembic environment configuration for Hogwarts Nexus Lumiere.

Supports both async (SQLite via aiosqlite, Postgres via asyncpg) and sync
migrations. Uses batch mode for SQLite (ALTER TABLE requires copy-during-batch)
and standard DDL for Postgres.

Target metadata is loaded directly from the application models to ensure
autogenerate always sees the canonical schema definition.
"""

import asyncio
import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

# Ensure the backend app is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.database import Base  # noqa: E402

# Load all model classes so their table definitions are registered on Base.metadata
import app.models  # noqa: E402, F401 (side-effect import to register model metadata)

# ── Alembic config ──────────────────────────────────────────────────────────
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ── Metadata ────────────────────────────────────────────────────────────────
target_metadata = Base.metadata

# ── URL ─────────────────────────────────────────────────────────────────────
from app.database import _prepare_url  # noqa: E402

raw_url, _ = _prepare_url(settings.DATABASE_URL)
is_sqlite = raw_url.startswith("sqlite")


def get_url():
    return raw_url


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (generate SQL without a live DB).

    Useful for reviewing SQL output and for CI where no DB is available.
    """
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
        render_as_batch=is_sqlite,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(sync_connection):
    """Run migrations from a synchronous connection."""
    context.configure(
        connection=sync_connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        render_as_batch=is_sqlite,
        # Include all tables regardless of schema matching
        include_schemas=True,
        # Alembic 1.18 defaults this to False: on PostgreSQL (transactional
        # DDL) all migrations then run in ONE transaction, so a single failing
        # migration rolls back the entire batch (and the alembic_version row),
        # leaving the app booting against an incomplete schema. Commit each
        # migration independently so a failure only affects that revision.
        transaction_per_migration=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode using an async engine.

    The async engine wraps a synchronous connection pool under the hood,
    but Alembic needs a synchronous connection for DDL operations.
    We use ``run_sync`` to bridge the gap.
    """
    connectable = create_async_engine(get_url(), echo=False)

    async with connectable.connect() as async_conn:
        await async_conn.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations online with async engine support.

    This is the default mode used by ``alembic upgrade`` / ``alembic downgrade``.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        # Already in an async context (e.g., from FastAPI lifespan)
        # Schedule the coroutine to run in the existing loop
        import concurrent.futures
        future = concurrent.futures.Future()

        def run_in_loop():
            try:
                asyncio.run(run_async_migrations())
                future.set_result(None)
            except Exception as e:
                future.set_exception(e)

        # Run in a separate thread to avoid event loop conflict
        import threading
        thread = threading.Thread(target=run_in_loop)
        thread.start()
        thread.join()
        future.result()
    else:
        asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()