"""add_pets_hide_creature_requirements_flag

Revision ID: f7f1ce34aa04
Revises: 31cd27ebdd56
Create Date: 2026-08-07 17:01:47.406277

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql, sqlite


# revision identifiers, used by Alembic.
revision: str = 'f7f1ce34aa04'
down_revision: Union[str, None] = '31cd27ebdd56'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent upsert that works on both SQLite (dev) and Postgres (prod).
    table = sa.table(
        "feature_flags",
        sa.column("key", sa.String),
        sa.column("name", sa.String),
        sa.column("description", sa.String),
        sa.column("enabled", sa.Boolean),
        sa.column("category", sa.String),
        sa.column("hidden", sa.Boolean),
        sa.column("created_at", sa.DateTime),
        sa.column("updated_at", sa.DateTime),
    )
    bind = op.get_bind()
    insert_cls = postgresql.insert if bind.dialect.name == "postgresql" else sqlite.insert
    stmt = insert_cls(table).values(
        key="pets.hide_creature_requirements",
        name="Ocultar Rareza y Niveles de Criaturas",
        description=(
            "Oculta los campos Rareza, Nivel Magico Req. y Nivel Santuario Req. "
            "en La Menajeria y en el panel de administracion. Al crear/editar se "
            "envian valores por defecto (Comun, Nv 1, Nv 0)."
        ),
        enabled=True,
        category="pets",
        hidden=False,
        created_at=sa.func.now(),
        updated_at=sa.func.now(),
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[table.c.key],
        set_={
            "name": stmt.excluded.name,
            "description": stmt.excluded.description,
            "category": stmt.excluded.category,
            "updated_at": sa.func.now(),
        },
    )
    op.execute(stmt)


def downgrade() -> None:
    op.execute("DELETE FROM feature_flags WHERE key = 'pets.hide_creature_requirements'")
