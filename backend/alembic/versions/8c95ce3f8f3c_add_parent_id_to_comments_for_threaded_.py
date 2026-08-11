"""add parent_id to comments for threaded replies

Revision ID: 8c95ce3f8f3c
Revises: 3285baf584bc
Create Date: 2026-08-11 15:51:01.204236

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8c95ce3f8f3c'
down_revision: Union[str, None] = '3285baf584bc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


FK_NAMES = {
    "post_comments": "fk_post_comments_parent_id",
    "article_comments": "fk_article_comments_parent_id",
    "forum_comments": "fk_forum_comments_parent_id",
}


def upgrade() -> None:
    # Threaded replies: each comment table gets an optional self-referencing
    # parent_id (NULL = top-level comment). SQLite needs batch_alter_table.
    for table in ("post_comments", "article_comments", "forum_comments"):
        with op.batch_alter_table(table, schema=None) as batch_op:
            batch_op.add_column(sa.Column("parent_id", sa.String(), nullable=True))
            batch_op.create_foreign_key(
                FK_NAMES[table], table, ["parent_id"], ["id"]
            )


def downgrade() -> None:
    for table in ("post_comments", "article_comments", "forum_comments"):
        with op.batch_alter_table(table, schema=None) as batch_op:
            batch_op.drop_constraint(FK_NAMES[table], type_="foreignkey")
            batch_op.drop_column("parent_id")