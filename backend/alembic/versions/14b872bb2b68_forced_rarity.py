"""Add forced_rarity to user_packs (roulette jackpot guarantee)."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '14b872bb2b68'
down_revision: Union[str, None] = 'bfb81e982ed0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('user_packs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('forced_rarity', sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('user_packs', schema=None) as batch_op:
        batch_op.drop_column('forced_rarity')