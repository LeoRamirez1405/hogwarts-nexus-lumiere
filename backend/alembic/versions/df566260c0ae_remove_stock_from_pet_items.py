"""remove_stock_from_pet_items

Revision ID: df566260c0ae
Revises: 3a2d11544d13
Create Date: 2026-09-06 18:54:53.789054

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'df566260c0ae'
down_revision: Union[str, None] = '3a2d11544d13'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Pet supplies have no availability limit (that logic belongs to the
    # marketplace products). Drop the column added by 3a2d11544d13.
    op.drop_column('pet_items', 'stock')


def downgrade() -> None:
    op.add_column(
        'pet_items',
        sa.Column('stock', sa.Integer(), server_default='0', nullable=False),
    )