"""add friend_requests table

Revision ID: 1333257105b8
Revises: d4e5f6a7b8c9
Create Date: 2026-08-06 16:10:08.956864

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1333257105b8'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('friend_requests',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('sender_id', sa.String(), nullable=False),
    sa.Column('receiver_id', sa.String(), nullable=False),
    sa.Column('status', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['receiver_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('sender_id', 'receiver_id', name='unique_friend_request')
    )


def downgrade() -> None:
    op.drop_table('friend_requests')
