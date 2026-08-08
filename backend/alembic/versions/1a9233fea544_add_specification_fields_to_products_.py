"""add specification fields to products and user_products

Revision ID: 1a9233fea544
Revises: e7f8a9b0c1d2
Create Date: 2026-08-08 00:04:48.084798

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1a9233fea544'
down_revision: Union[str, None] = 'e7f8a9b0c1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.add_column(sa.Column('requires_specification', sa.Boolean(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('specification_placeholder', sa.Text(), nullable=True))

    with op.batch_alter_table('user_products', schema=None) as batch_op:
        batch_op.add_column(sa.Column('specification', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('user_products', schema=None) as batch_op:
        batch_op.drop_column('specification')

    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.drop_column('specification_placeholder')
        batch_op.drop_column('requires_specification')
