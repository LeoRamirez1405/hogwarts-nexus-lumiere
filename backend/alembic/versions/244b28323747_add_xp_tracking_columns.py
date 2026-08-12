"""add_xp_tracking_columns

Revision ID: 244b28323747
Revises: 41cbeefdfb35
Create Date: 2026-08-11 23:27:06.160225

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '244b28323747'
down_revision: Union[str, None] = '41cbeefdfb35'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('daily_logins', sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('profile_completed_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('profile_completed_at')
        batch_op.drop_column('daily_logins')
