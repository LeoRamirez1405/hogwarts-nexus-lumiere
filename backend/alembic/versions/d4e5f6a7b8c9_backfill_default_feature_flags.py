"""backfill default feature flags on adopted databases

Databases that were adopted into Alembic (stamped at head without running the
historical seed migration ``91bae5f43996``) never received feature flags that
were added to the seed after their initial create_all seeding -- notably
``events.enabled``. This migration reconciles the default flags idempotently so
those databases get the missing ones, and hides the internal seed marker that
predates the ``hidden`` column (it defaulted to visible).

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-08-05 13:20:00.000000

"""
from datetime import datetime
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Same defaults as app.seed.seed_feature_flags (all OFF except events).
_DEFAULT_FLAGS = [
    {
        "key": "dashboard.winning_house",
        "name": "Casa Ganadora (Dashboard Admin)",
        "description": "Muestra la sección 'Casa Ganadora' con el ranking de puntos por casa en el dashboard de administrador.",
        "enabled": False,
        "category": "dashboard",
        "hidden": False,
    },
    {
        "key": "treasury.withdraw",
        "name": "Retirar Zerines (Tesorería)",
        "description": "Habilita la pestaña 'Retirar' en la Cámara de Tesorería para que los usuarios puedan retirar zerines.",
        "enabled": False,
        "category": "treasury",
        "hidden": False,
    },
    {
        "key": "pets.market",
        "name": "Mercado de Mascotas (La Menajería)",
        "description": "Habilita la pestaña 'Mercado' y la opción de poner mascotas en venta en La Menajería Susurrante.",
        "enabled": False,
        "category": "pets",
        "hidden": False,
    },
    {
        "key": "events.enabled",
        "name": "Eventos en Grupos",
        "description": "Habilita la creación y gestión de eventos en las salas de chat. Los administradores y moderadores pueden crear eventos con RSVP, recordatorios y canales de voz.",
        "enabled": True,
        "category": "events",
        "hidden": False,
    },
]


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.utcnow()

    insert_sql = sa.text(
        "INSERT INTO feature_flags "
        "(key, name, description, enabled, category, hidden, created_at, updated_at) "
        "VALUES (:key, :name, :description, :enabled, :category, :hidden, :created_at, :updated_at)"
    )
    for flag in _DEFAULT_FLAGS:
        exists = conn.execute(
            sa.text("SELECT 1 FROM feature_flags WHERE key = :key"), {"key": flag["key"]}
        ).first()
        if exists:
            continue
        conn.execute(insert_sql, {**flag, "created_at": now, "updated_at": now})

    # Hide the internal seed marker on older DBs where it defaulted to visible.
    conn.execute(
        sa.text("UPDATE feature_flags SET hidden = :hidden WHERE key = :key"),
        {"hidden": True, "key": "system.initial_seed_done"},
    )


def downgrade() -> None:
    # Only remove the flag this migration is specifically responsible for
    # backfilling; the others may predate it.
    conn = op.get_bind()
    conn.execute(sa.text("DELETE FROM feature_flags WHERE key = 'events.enabled'"))
