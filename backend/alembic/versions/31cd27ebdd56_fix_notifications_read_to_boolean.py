"""fix notifications.read to boolean

Pre-Alembic databases created the ``notifications.read`` column as
VARCHAR(4) ("true"/"false" strings) via the old model, and the code-only
switch to Boolean (commit 67319d0) never altered the stored column type.
Postgres then rejects the compiled ``read IS false`` predicate with
``argument of IS FALSE must be type boolean``, turning every
POST /notifications/read-batch into a 500.

This migration normalizes any legacy string values and converts the column
to BOOLEAN in place. Databases whose column is already Boolean are skipped
(fresh DBs, local dev).

Revision ID: 31cd27ebdd56
Revises: 1333257105b8
Create Date: 2026-08-07 12:33:14.502085

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '31cd27ebdd56'
down_revision: Union[str, None] = '1333257105b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _is_boolean(col_type) -> bool:
    return isinstance(col_type, sa.Boolean)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"]: c for c in inspector.get_columns("notifications")}
    column = columns.get("read")
    if column is None or _is_boolean(column["type"]):
        return

    # Legacy rows hold string truth values ("true"/"false" from the old
    # String model, possibly "1"/"0" written by other paths). Normalize
    # everything to the two spellings Postgres accepts for ::boolean so the
    # cast below can never fail.
    op.execute(
        """
        UPDATE notifications
        SET read = CASE
            WHEN lower(read) IN ('true', 't', '1', 'yes', 'y', 'on') THEN 'true'
            ELSE 'false'
        END
        """
    )

    if bind.dialect.name == "postgresql":
        op.alter_column(
            "notifications",
            "read",
            existing_type=sa.String(),
            type_=sa.Boolean(),
            existing_nullable=False,
            nullable=False,
            postgresql_using="read::boolean",
        )
    else:
        # SQLite cannot ALTER COLUMN TYPE; batch mode rebuilds the table.
        with op.batch_alter_table("notifications") as batch_op:
            batch_op.alter_column(
                "read",
                existing_type=sa.String(),
                type_=sa.Boolean(),
                existing_nullable=False,
                nullable=False,
            )
        # The rebuild copies text as-is; store real SQLite booleans (0/1).
        op.execute(
            """
            UPDATE notifications
            SET read = CASE WHEN read IN ('true', '1') THEN 1 ELSE 0 END
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"]: c for c in inspector.get_columns("notifications")}
    if "read" not in columns:
        return
    if bind.dialect.name == "postgresql":
        op.alter_column(
            "notifications",
            "read",
            existing_type=sa.Boolean(),
            type_=sa.String(),
            existing_nullable=False,
            nullable=False,
            postgresql_using="read::text",
        )
    else:
        with op.batch_alter_table("notifications") as batch_op:
            batch_op.alter_column(
                "read",
                existing_type=sa.Boolean(),
                type_=sa.String(),
                existing_nullable=False,
                nullable=False,
            )
        op.execute(
            "UPDATE notifications SET read = CASE WHEN read IN (1, 'true') THEN 'true' ELSE 'false' END"
        )
