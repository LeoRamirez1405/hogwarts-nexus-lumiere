"""add deleted_at and removed_at to conversation prefs

Revision ID: 69ac6c6b6764
Revises: 8fdabb64fb5a
Create Date: 2026-08-16 01:42:56.499023

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '69ac6c6b6764'
down_revision: Union[str, None] = '8fdabb64fb5a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('user_conversation_preferences', schema=None) as batch_op:
        batch_op.add_column(sa.Column('deleted_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('removed_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('user_conversation_preferences', schema=None) as batch_op:
        batch_op.drop_column('removed_at')
        batch_op.drop_column('deleted_at')