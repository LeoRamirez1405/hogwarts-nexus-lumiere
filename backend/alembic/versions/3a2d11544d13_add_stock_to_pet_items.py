"""add stock to pet items

Revision ID: 3a2d11544d13
Revises: b20b89ff5194
Create Date: 2026-09-04 23:47:20.451362

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3a2d11544d13'
down_revision: Union[str, None] = 'b20b89ff5194'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Availability counter for pet food/toys: 0 = sold out (hidden from the
    # user shop). server_default='0' backfills existing rows and lets SQLite
    # add a NOT NULL column to a populated table.
    op.add_column(
        'pet_items',
        sa.Column('stock', sa.Integer(), server_default='0', nullable=False),
    )


def downgrade() -> None:
    op.drop_column('pet_items', 'stock')