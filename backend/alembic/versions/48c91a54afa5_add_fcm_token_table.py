"""add fcm_token table

Revision ID: 48c91a54afa5
Revises: b3680516518b
Create Date: 2026-08-17 18:23:41.330072
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '48c91a54afa5'
down_revision: Union[str, None] = 'b3680516518b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS fcm_tokens CASCADE"))
    op.create_table(
        'fcm_tokens',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('token', sa.String(), nullable=False),
        sa.Column('platform', sa.String(), nullable=False),
        sa.Column('user_agent', sa.String(), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'token', name='uq_user_fcm_token')
    )
    op.create_index(op.f('ix_fcm_tokens_token'), 'fcm_tokens', ['token'], unique=False)
    op.create_index('ix_fcm_tokens_user_active', 'fcm_tokens', ['user_id', 'active'], unique=False)
    op.create_index(op.f('ix_fcm_tokens_user_id'), 'fcm_tokens', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_fcm_tokens_user_active', table_name='fcm_tokens')
    op.drop_index(op.f('ix_fcm_tokens_user_id'), table_name='fcm_tokens')
    op.drop_index(op.f('ix_fcm_tokens_token'), table_name='fcm_tokens')
    op.drop_table('fcm_tokens')