"""add rsvp reminder flags

Revision ID: a1b2c3d4e5f6
Revises: 558a3e0944b0
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '558a3e0944b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('event_rsvps', schema=None) as batch_op:
        batch_op.add_column(sa.Column('reminded_1h', sa.Boolean(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('reminded_5m', sa.Boolean(), server_default='0', nullable=False))


def downgrade() -> None:
    with op.batch_alter_table('event_rsvps', schema=None) as batch_op:
        batch_op.drop_column('reminded_5m')
        batch_op.drop_column('reminded_1h')
