"""free spins columna ruleta

Revision ID: 8fdabb64fb5a
Revises: 8a37608cd371
Create Date: 2026-08-13 23:23:49.159511

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8fdabb64fb5a'
down_revision: Union[str, None] = '8a37608cd371'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('free_spins', sa.Integer(), server_default='0', nullable=False))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('free_spins')
