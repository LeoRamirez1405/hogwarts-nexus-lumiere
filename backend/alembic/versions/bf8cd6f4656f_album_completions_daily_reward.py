"""album completions, daily reward

Revision ID: bf8cd6f4656f
Revises: 14b872bb2b68
Create Date: 2026-08-13 14:14:36.094257

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bf8cd6f4656f'
down_revision: Union[str, None] = '14b872bb2b68'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('albums', schema=None) as batch_op:
        batch_op.add_column(sa.Column('first_completed_by', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('first_completed_at', sa.DateTime(), nullable=True))
        batch_op.create_foreign_key('fk_albums_first_completed_by_users', 'users', ['first_completed_by'], ['id'])

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('last_daily_reward_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('last_daily_reward_at')

    with op.batch_alter_table('albums', schema=None) as batch_op:
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.drop_column('first_completed_at')
        batch_op.drop_column('first_completed_by')