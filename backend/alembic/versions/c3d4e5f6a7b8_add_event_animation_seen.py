"""add event_animation_seen table

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-08-05 00:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'event_animation_seen',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('event_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('seen_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['event_id'], ['events.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('event_id', 'user_id', name='uq_event_user_seen'),
    )
    with op.batch_alter_table('event_animation_seen', schema=None) as batch_op:
        batch_op.create_index('ix_event_animation_seen_event_id', ['event_id'])
        batch_op.create_index('ix_event_animation_seen_user_id', ['user_id'])


def downgrade() -> None:
    with op.batch_alter_table('event_animation_seen', schema=None) as batch_op:
        batch_op.drop_index('ix_event_animation_seen_user_id')
        batch_op.drop_index('ix_event_animation_seen_event_id')
    op.drop_table('event_animation_seen')
