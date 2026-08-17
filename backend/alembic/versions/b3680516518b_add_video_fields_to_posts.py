"""add video fields to posts

Revision ID: b3680516518b
Revises: 2dfe4089992a
Create Date: 2026-08-17 00:08:19.488292

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3680516518b'
down_revision: Union[str, None] = '2dfe4089992a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('posts', schema=None) as batch_op:
        batch_op.add_column(sa.Column('video_url', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('video_poster_url', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('video_duration', sa.Float(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('posts', schema=None) as batch_op:
        batch_op.drop_column('video_duration')
        batch_op.drop_column('video_poster_url')
        batch_op.drop_column('video_url')