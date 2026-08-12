"""add receive_marketplace_notifications to users

Revision ID: 41cbeefdfb35
Revises: 6dd79fb02829
Create Date: 2026-08-11 21:14:03.311789

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '41cbeefdfb35'
down_revision: Union[str, None] = '6dd79fb02829'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'receive_marketplace_notifications',
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('receive_marketplace_notifications')
