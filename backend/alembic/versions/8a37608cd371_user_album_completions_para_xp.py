"""user album completions para XP

Revision ID: 8a37608cd371
Revises: 83a6ffb2ea3e
Create Date: 2026-08-13 21:59:19.173414

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8a37608cd371'
down_revision: Union[str, None] = '83a6ffb2ea3e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'user_album_completions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('album_id', sa.String(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['album_id'], ['albums.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'album_id', name='uq_user_album_completion'),
    )
    op.create_index(
        op.f('ix_user_album_completions_user_id'),
        'user_album_completions',
        ['user_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_user_album_completions_album_id'),
        'user_album_completions',
        ['album_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f('ix_user_album_completions_album_id'),
        table_name='user_album_completions',
    )
    op.drop_index(
        op.f('ix_user_album_completions_user_id'),
        table_name='user_album_completions',
    )
    op.drop_table('user_album_completions')
