"""add cascade delete to user_product product_id foreign key

Revision ID: 2dfe4089992a
Revises: 69ac6c6b6764
Create Date: 2026-08-16 18:48:39.003273

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2dfe4089992a'
down_revision: Union[str, None] = '69ac6c6b6764'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite doesn't support ALTER TABLE DROP CONSTRAINT, so we recreate the table.
    # Types are declared via sa.* so Alembic renders DATETIME on SQLite and
    # TIMESTAMP on PostgreSQL (Postgres has no "datetime" type).
    op.create_table(
        "user_products_new",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("product_id", sa.String(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("purchased_at", sa.DateTime(), nullable=False),
        sa.Column("specification", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_user_products_user_id_users"
        ),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.id"],
            ondelete="CASCADE",
            name="fk_user_products_product_id_products",
        ),
    )
    op.execute(
        "INSERT INTO user_products_new (id, user_id, product_id, quantity, purchased_at, specification) "
        "SELECT id, user_id, product_id, quantity, purchased_at, specification FROM user_products"
    )
    op.execute("DROP TABLE user_products")
    op.execute("ALTER TABLE user_products_new RENAME TO user_products")
    op.create_index("ix_user_products_user_id", "user_products", ["user_id"])


def downgrade() -> None:
    # Revert to foreign key without CASCADE
    op.create_table(
        "user_products_old",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("product_id", sa.String(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("purchased_at", sa.DateTime(), nullable=False),
        sa.Column("specification", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_user_products_user_id_users"
        ),
        sa.ForeignKeyConstraint(
            ["product_id"], ["products.id"], name="fk_user_products_product_id_products"
        ),
    )
    op.execute(
        "INSERT INTO user_products_old (id, user_id, product_id, quantity, purchased_at, specification) "
        "SELECT id, user_id, product_id, quantity, purchased_at, specification FROM user_products"
    )
    op.execute("DROP TABLE user_products")
    op.execute("ALTER TABLE user_products_old RENAME TO user_products")
    op.create_index("ix_user_products_user_id", "user_products", ["user_id"])