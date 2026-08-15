"""foil cards y badges del album

Revision ID: 83a6ffb2ea3e
Revises: bf8cd6f4656f
Create Date: 2026-08-13 20:16:50.148281

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '83a6ffb2ea3e'
down_revision: Union[str, None] = 'bf8cd6f4656f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'user_badges',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('badge_key', sa.String(), nullable=False),
        sa.Column('label', sa.String(), nullable=False),
        sa.Column('icon', sa.String(), nullable=True),
        sa.Column('granted_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'badge_key', name='uq_user_badge_key'),
    )
    op.create_index('ix_user_badges_user_id', 'user_badges', ['user_id'], unique=False)

    # Variante foil dorada (1%): las filas existentes quedan no-foil.
    # server_default como string ("0") en vez de sa.text("0"): PostgreSQL
    # rechaza `DEFAULT 0` (entero) sobre columna BOOLEAN; con "0" emite
    # `DEFAULT '0'` que Postgres castea a boolean. SQLite acepta ambos.
    with op.batch_alter_table('user_cards', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('foil', sa.Boolean(), nullable=False, server_default='0')
        )


def downgrade() -> None:
    with op.batch_alter_table('user_cards', schema=None) as batch_op:
        batch_op.drop_column('foil')

    op.drop_index('ix_user_badges_user_id', table_name='user_badges')
    op.drop_table('user_badges')