"""fix demo user password hashes

Revision ID: 558a3e0944b0
Revises: 91bae5f43996
Create Date: 2026-08-04 03:09:25.124523

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '558a3e0944b0'
down_revision: Union[str, None] = '91bae5f43996'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The original seed migration (91bae5f43996) shipped a single malformed
    # hash for every demo user, so login failed for all accounts. Replace it
    # with the real bcrypt hashes for "admin123" / "user123". Idempotent:
    # running it again simply rewrites the same hashes.
    demo_ids = [
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
        "00000000-0000-0000-0000-000000000003",
        "00000000-0000-0000-0000-000000000004",
        "00000000-0000-0000-0000-000000000005",
    ]
    users = sa.table(
        "users",
        sa.column("id", sa.String),
        sa.column("email", sa.String),
        sa.column("password_hash", sa.String),
    )
    op.execute(
        users.update()
        .where(users.c.id == demo_ids[0])
        .values(
            password_hash="$2b$12$Gwq23dl4JYN1XMAt.ylwfOvH4P1unDbMi6WrMZ2snpO8w4c.cMeHy"
        )
    )
    op.execute(
        users.update()
        .where(users.c.id.in_(demo_ids[1:]))
        .values(
            password_hash="$2b$12$OEAga83wnDfKEYUls7wS2uUv5AKQ9S7tn7q/yyXjqDbJWHHoe6P4i"
        )
    )


def downgrade() -> None:
    # Intentionally left empty: we cannot restore the broken hash meaningfully.
    pass