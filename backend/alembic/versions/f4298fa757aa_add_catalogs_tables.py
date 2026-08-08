"""add catalogs tables

Revision ID: f4298fa757aa
Revises: 1a9233fea544
Create Date: 2026-08-08 01:14:09.737322

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4298fa757aa'
down_revision: Union[str, None] = '1a9233fea544'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('catalogs',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('cover_image_url', sa.String(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('catalog_items',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('catalog_id', sa.String(), nullable=False),
    sa.Column('numero', sa.Integer(), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('image_url', sa.String(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['catalog_id'], ['catalogs.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('catalog_id', 'numero', name='uq_catalog_item_numero')
    )
    with op.batch_alter_table('catalog_items', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_catalog_items_catalog_id'), ['catalog_id'], unique=False)

    op.create_table('catalog_item_favorites',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('user_id', sa.String(), nullable=False),
    sa.Column('catalog_item_id', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['catalog_item_id'], ['catalog_items.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'catalog_item_id', name='uq_user_catalog_item_fav')
    )


def downgrade() -> None:
    op.drop_table('catalog_item_favorites')
    with op.batch_alter_table('catalog_items', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_catalog_items_catalog_id'))

    op.drop_table('catalog_items')
    op.drop_table('catalogs')
