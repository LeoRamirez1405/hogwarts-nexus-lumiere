"""add_pets_hide_creature_requirements_flag

Revision ID: f7f1ce34aa04
Revises: 31cd27ebdd56
Create Date: 2026-08-07 17:01:47.406277

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'f7f1ce34aa04'
down_revision: Union[str, None] = '31cd27ebdd56'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        INSERT INTO feature_flags (key, name, description, enabled, category, hidden, created_at, updated_at)
        VALUES (
            'pets.hide_creature_requirements',
            'Ocultar Rareza y Niveles de Criaturas',
            'Oculta los campos Rareza, Nivel Magico Req. y Nivel Santuario Req. en La Menajeria y en el panel de administracion. Al crear/editar se envian valores por defecto (Comun, Nv 1, Nv 0).',
            true,
            'pets',
            false,
            NOW(),
            NOW()
        )
        ON CONFLICT (key) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            category = EXCLUDED.category,
            updated_at = NOW()
    """)


def downgrade() -> None:
    op.execute("DELETE FROM feature_flags WHERE key = 'pets.hide_creature_requirements'")