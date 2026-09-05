"""recover orphaned production revision

Production's alembic_version points to c7f8e9d0b1a2, but no migration file with
that revision was ever committed (checked against git history). Alembic then
cannot resolve the current revision and every ``upgrade head`` fails, silently
blocking later migrations (e.g. pet item stock) on an already-populated DB.

This is a no-op node inserted at that revision so Alembic can resolve the chain
and continue to the real head. The upgrade this node composes is a no-op for
every database (including fresh ones), so it never changes the schema.

Revision ID: c7f8e9d0b1a2
Revises: b20b89ff5194
Create Date: 2026-09-05 04:35:00.000000

"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = 'c7f8e9d0b1a2'
down_revision: Union[str, None] = 'b20b89ff5194'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass