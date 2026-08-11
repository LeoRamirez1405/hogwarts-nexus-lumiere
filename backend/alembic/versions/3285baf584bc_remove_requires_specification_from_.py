"""remove requires_specification from products - all flourish products now require specification

Revision ID: 3285baf584bc
Revises: f4298fa757aa
Create Date: 2026-08-09 19:35:53.308028

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3285baf584bc'
down_revision: Union[str, None] = 'f4298fa757aa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.drop_column('requires_specification')


def downgrade() -> None:
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.add_column(sa.Column('requires_specification', sa.Boolean(), server_default='0', nullable=False))
