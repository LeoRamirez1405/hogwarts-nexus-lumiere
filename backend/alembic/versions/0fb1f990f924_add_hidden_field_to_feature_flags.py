"""add hidden field to feature_flags

Revision ID: 0fb1f990f924
Revises: 23c12a9f568c
Create Date: 2026-08-04 00:28:30.787630

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0fb1f990f924'
down_revision: Union[str, None] = '23c12a9f568c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('feature_flags', schema=None) as batch_op:
        batch_op.add_column(sa.Column('hidden', sa.Boolean(), server_default='0', nullable=False))


def downgrade() -> None:
    with op.batch_alter_table('feature_flags', schema=None) as batch_op:
        batch_op.drop_column('hidden')