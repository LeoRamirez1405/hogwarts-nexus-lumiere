"""fix dm conversation prefs pointing at the user themself

Revision ID: e7f8a9b0c1d2
Revises: f7f1ce34aa04
Create Date: 2026-08-07 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, None] = "f7f1ce34aa04"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DM_COLUMNS = [
    "last_message_id",
    "last_message_body",
    "last_message_at",
    "last_message_sender_id",
    "last_message_kind",
    "last_message_attachment_url",
    "last_message_attachment_type",
    "last_message_attachment_name",
]


def upgrade() -> None:
    # A bug in _update_conversation_preferences created DM preference rows
    # where conversation_id == user_id (a phantom "chat with myself"). For
    # each such row, re-point it at the real partner derived from message
    # history, merging into an existing correct row when one already exists.
    bind = op.get_bind()
    prefs = sa.table(
        "user_conversation_preferences",
        sa.column("id", sa.String),
        sa.column("user_id", sa.String),
        sa.column("conversation_type", sa.String),
        sa.column("conversation_id", sa.String),
        sa.column("unread_count", sa.Integer),
        sa.column("last_message_id", sa.String),
        sa.column("last_message_body", sa.Text),
        sa.column("last_message_at", sa.DateTime),
        sa.column("last_message_sender_id", sa.String),
        sa.column("last_message_kind", sa.String),
        sa.column("last_message_attachment_url", sa.String),
        sa.column("last_message_attachment_type", sa.String),
        sa.column("last_message_attachment_name", sa.String),
    )
    messages = sa.table(
        "messages",
        sa.column("id", sa.String),
        sa.column("sender_id", sa.String),
        sa.column("receiver_id", sa.String),
        sa.column("room_id", sa.String),
        sa.column("created_at", sa.DateTime),
    )

    bad_rows = bind.execute(
        sa.select(
            prefs.c.id,
            prefs.c.user_id,
            prefs.c.conversation_id,
            prefs.c.unread_count,
            *[prefs.c[c] for c in DM_COLUMNS],
        ).where(
            prefs.c.conversation_type == "dm",
            prefs.c.conversation_id == prefs.c.user_id,
        )
    ).fetchall()

    for row in bad_rows:
        user_id = row.user_id
        partner_id = None

        if row.last_message_sender_id and row.last_message_sender_id != user_id:
            partner_id = row.last_message_sender_id

        if not partner_id:
            latest = bind.execute(
                sa.select(
                    messages.c.sender_id,
                    messages.c.receiver_id,
                )
                .where(
                    messages.c.room_id.is_(None),
                    sa.or_(
                        sa.and_(
                            messages.c.sender_id == user_id,
                            messages.c.receiver_id.is_not(None),
                        ),
                        messages.c.receiver_id == user_id,
                    ),
                )
                .order_by(messages.c.created_at.desc(), messages.c.id.desc())
                .limit(1)
            ).first()
            if latest:
                partner_id = latest.receiver_id if latest.sender_id == user_id else latest.sender_id

        if not partner_id:
            bind.execute(sa.delete(prefs).where(prefs.c.id == row.id))
            continue

        correct_row = bind.execute(
            sa.select(prefs.c.id, prefs.c.unread_count, prefs.c.last_message_at).where(
                prefs.c.user_id == user_id,
                prefs.c.conversation_type == "dm",
                prefs.c.conversation_id == partner_id,
            )
        ).first()

        if correct_row:
            values = {"unread_count": (correct_row.unread_count or 0) + (row.unread_count or 0)}
            if row.last_message_at and (
                correct_row.last_message_at is None or row.last_message_at > correct_row.last_message_at
            ):
                for c in DM_COLUMNS:
                    values[c] = getattr(row, c)
            bind.execute(
                sa.update(prefs).where(prefs.c.id == correct_row.id).values(**values)
            )
            bind.execute(sa.delete(prefs).where(prefs.c.id == row.id))
        else:
            bind.execute(
                sa.update(prefs)
                .where(prefs.c.id == row.id)
                .values(conversation_id=partner_id)
            )


def downgrade() -> None:
    # Intentionally left empty: the repaired rows cannot be meaningfully
    # re-broken without losing partner information.
    pass
