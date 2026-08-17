"""add cascade delete to user_product product_id foreign key

Revision ID: 2dfe4089992a
Revises: 69ac6c6b6764
Create Date: 2026-08-16 18:48:39.003273

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '2dfe4089992a'
down_revision: Union[str, None] = '69ac6c6b6764'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite doesn't support ALTER TABLE DROP CONSTRAINT, so we recreate the table
    op.execute("""
        CREATE TABLE user_products_new (
            id VARCHAR NOT NULL,
            user_id VARCHAR NOT NULL,
            product_id VARCHAR NOT NULL,
            quantity INTEGER NOT NULL,
            purchased_at DATETIME NOT NULL,
            specification TEXT,
            PRIMARY KEY (id),
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
        )
    """)
    op.execute("INSERT INTO user_products_new (id, user_id, product_id, quantity, purchased_at, specification) SELECT id, user_id, product_id, quantity, purchased_at, specification FROM user_products")
    op.execute("DROP TABLE user_products")
    op.execute("ALTER TABLE user_products_new RENAME TO user_products")
    op.execute("CREATE INDEX ix_user_products_user_id ON user_products (user_id)")


def downgrade() -> None:
    # Revert to foreign key without CASCADE
    op.execute("""
        CREATE TABLE user_products_old (
            id VARCHAR NOT NULL,
            user_id VARCHAR NOT NULL,
            product_id VARCHAR NOT NULL,
            quantity INTEGER NOT NULL,
            purchased_at DATETIME NOT NULL,
            specification TEXT,
            PRIMARY KEY (id),
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (product_id) REFERENCES products (id)
        )
    """)
    op.execute("INSERT INTO user_products_old (id, user_id, product_id, quantity, purchased_at, specification) SELECT id, user_id, product_id, quantity, purchased_at, specification FROM user_products")
    op.execute("DROP TABLE user_products")
    op.execute("ALTER TABLE user_products_old RENAME TO user_products")
    op.execute("CREATE INDEX ix_user_products_user_id ON user_products (user_id)")