"""add media fields to comments

Revision ID: b20b89ff5194
Revises: 48c91a54afa5
Create Date: 2026-08-20 15:00:35.530374

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b20b89ff5194'
down_revision: Union[str, None] = '48c91a54afa5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Indexes this migration drops.  On PostgreSQL the indexes may already be
# absent (or named differently) so we use DROP INDEX IF EXISTS.
_INDEXES_TO_DROP = [
    ("ix_article_comments_article_id", "article_comments"),
    ("ix_article_subscriptions_user_id", "article_subscriptions"),
    ("ix_chat_room_members_room_id", "chat_room_members"),
    ("ix_chat_room_members_user_id", "chat_room_members"),
    ("ix_forum_comments_thread_id", "forum_comments"),
    ("ix_forum_thread_votes_thread_id", "forum_thread_votes"),
    ("ix_forum_threads_author_id", "forum_threads"),
    ("ix_friend_requests_receiver_id", "friend_requests"),
    ("ix_friend_requests_sender_id", "friend_requests"),
    ("ix_message_reactions_message_id", "message_reactions"),
    ("ix_messages_created_at", "messages"),
    ("ix_messages_pinned", "messages"),
    ("ix_messages_receiver_id", "messages"),
    ("ix_messages_room_id", "messages"),
    ("ix_messages_room_id_created_at", "messages"),
    ("ix_messages_room_id_read", "messages"),
    ("ix_messages_sender_id", "messages"),
    ("ix_messages_sender_id_receiver_id_created_at", "messages"),
    ("ix_notifications_user_id", "notifications"),
    ("ix_notifications_user_id_created_at", "notifications"),
    ("ix_notifications_user_id_read", "notifications"),
    ("ix_post_comments_post_id", "post_comments"),
    ("ix_post_likes_post_id", "post_likes"),
    ("ix_post_likes_user_id", "post_likes"),
    ("ix_post_reposts_post_id", "post_reposts"),
    ("ix_posts_author_id", "posts"),
    ("ix_posts_created_at", "posts"),
    ("ix_products_shop_category", "products"),
    ("ix_transactions_receiver_id", "transactions"),
    ("ix_transactions_sender_id", "transactions"),
    ("ix_user_creatures_creature_id", "user_creatures"),
    ("ix_user_creatures_for_sale", "user_creatures"),
    ("ix_user_creatures_user_id", "user_creatures"),
    ("ix_user_pet_items_user_id", "user_pet_items"),
    ("ix_user_products_user_id", "user_products"),
    ("ix_users_house", "users"),
    ("ix_users_name", "users"),
]


def _drop_indexes_pg():
    """Drop indexes using raw SQL with IF EXISTS (PostgreSQL)."""
    for idx_name, _table in _INDEXES_TO_DROP:
        op.execute(f"DROP INDEX IF EXISTS {idx_name}")


def _drop_indexes_sqlite():
    """Drop indexes via batch_alter_table (SQLite)."""
    # SQLite stores partial indexes differently; handle them separately.
    _sqlite_only = {
        "ix_messages_pinned_true",
        "ix_messages_receiver_id_unread",
        "ix_messages_room_id_unread",
        "ix_messages_sender_receiver_unread",
    }
    for idx_name, table in _INDEXES_TO_DROP:
        if idx_name in _sqlite_only:
            with op.batch_alter_table(table, schema=None) as batch_op:
                batch_op.drop_index(batch_op.f(idx_name), sqlite_where=sa.text(
                    "pinned = 1" if "pinned_true" in idx_name else "read = 0"
                ))
        else:
            with op.batch_alter_table(table, schema=None) as batch_op:
                batch_op.drop_index(batch_op.f(idx_name))


def upgrade() -> None:
    dialect = op.get_bind().dialect.name
    is_pg = dialect == "postgresql"

    if is_pg:
        # PostgreSQL: plain ALTER TABLE + DROP INDEX IF EXISTS
        op.add_column("article_comments", sa.Column("image_url", sa.String(), nullable=True))
        op.add_column("article_comments", sa.Column("video_url", sa.String(), nullable=True))
        op.add_column("article_comments", sa.Column("video_poster_url", sa.String(), nullable=True))
        op.add_column("article_comments", sa.Column("video_duration", sa.Integer(), nullable=True))

        op.add_column("forum_comments", sa.Column("image_url", sa.String(), nullable=True))
        op.add_column("forum_comments", sa.Column("video_url", sa.String(), nullable=True))
        op.add_column("forum_comments", sa.Column("video_poster_url", sa.String(), nullable=True))
        op.add_column("forum_comments", sa.Column("video_duration", sa.Integer(), nullable=True))

        op.add_column("post_comments", sa.Column("image_url", sa.String(), nullable=True))
        op.add_column("post_comments", sa.Column("video_url", sa.String(), nullable=True))
        op.add_column("post_comments", sa.Column("video_poster_url", sa.String(), nullable=True))
        op.add_column("post_comments", sa.Column("video_duration", sa.Integer(), nullable=True))

        _drop_indexes_pg()
    else:
        # SQLite: use batch_alter_table
        with op.batch_alter_table("article_comments", schema=None) as batch_op:
            batch_op.add_column(sa.Column("image_url", sa.String(), nullable=True))
            batch_op.add_column(sa.Column("video_url", sa.String(), nullable=True))
            batch_op.add_column(sa.Column("video_poster_url", sa.String(), nullable=True))
            batch_op.add_column(sa.Column("video_duration", sa.Integer(), nullable=True))

        with op.batch_alter_table("forum_comments", schema=None) as batch_op:
            batch_op.add_column(sa.Column("image_url", sa.String(), nullable=True))
            batch_op.add_column(sa.Column("video_url", sa.String(), nullable=True))
            batch_op.add_column(sa.Column("video_poster_url", sa.String(), nullable=True))
            batch_op.add_column(sa.Column("video_duration", sa.Integer(), nullable=True))

        with op.batch_alter_table("post_comments", schema=None) as batch_op:
            batch_op.add_column(sa.Column("image_url", sa.String(), nullable=True))
            batch_op.add_column(sa.Column("video_url", sa.String(), nullable=True))
            batch_op.add_column(sa.Column("video_poster_url", sa.String(), nullable=True))
            batch_op.add_column(sa.Column("video_duration", sa.Integer(), nullable=True))

        _drop_indexes_sqlite()


def downgrade() -> None:
    dialect = op.get_bind().dialect.name
    is_pg = dialect == "postgresql"

    if is_pg:
        # Recreate dropped indexes
        op.create_index("ix_users_name", "users", ["name"], unique=False)
        op.create_index("ix_users_house", "users", ["house"], unique=False)
        op.create_index("ix_user_products_user_id", "user_products", ["user_id"], unique=False)
        op.create_index("ix_user_pet_items_user_id", "user_pet_items", ["user_id"], unique=False)
        op.create_index("ix_user_creatures_user_id", "user_creatures", ["user_id"], unique=False)
        op.create_index("ix_user_creatures_for_sale", "user_creatures", ["for_sale"], unique=False)
        op.create_index("ix_user_creatures_creature_id", "user_creatures", ["creature_id"], unique=False)
        op.create_index("ix_transactions_sender_id", "transactions", ["sender_id"], unique=False)
        op.create_index("ix_transactions_receiver_id", "transactions", ["receiver_id"], unique=False)
        op.create_index("ix_products_shop_category", "products", ["shop", "category"], unique=False)
        op.create_index("ix_posts_created_at", "posts", ["created_at"], unique=False)
        op.create_index("ix_posts_author_id", "posts", ["author_id"], unique=False)
        op.create_index("ix_post_reposts_post_id", "post_reposts", ["post_id"], unique=False)
        op.create_index("ix_post_likes_user_id", "post_likes", ["user_id"], unique=False)
        op.create_index("ix_post_likes_post_id", "post_likes", ["post_id"], unique=False)
        op.create_index("ix_post_comments_post_id", "post_comments", ["post_id"], unique=False)
        op.create_index("ix_notifications_user_id", "notifications", ["user_id"], unique=False)
        op.create_index("ix_notifications_user_id_created_at", "notifications", ["user_id", "created_at"], unique=False)
        op.create_index("ix_notifications_user_id_read", "notifications", ["user_id", "read"], unique=False)
        op.create_index("ix_messages_sender_id", "messages", ["sender_id"], unique=False)
        op.create_index("ix_messages_sender_id_receiver_id_created_at", "messages", ["sender_id", "receiver_id", "created_at"], unique=False)
        op.create_index("ix_messages_sender_receiver_unread", "messages", ["sender_id", "receiver_id"], unique=False, postgresql_where=sa.text("read = 0"))
        op.create_index("ix_messages_room_id", "messages", ["room_id"], unique=False)
        op.create_index("ix_messages_room_id_created_at", "messages", ["room_id", "created_at"], unique=False)
        op.create_index("ix_messages_room_id_read", "messages", ["room_id", "read"], unique=False)
        op.create_index("ix_messages_room_id_unread", "messages", ["room_id"], unique=False, postgresql_where=sa.text("read = 0"))
        op.create_index("ix_messages_receiver_id", "messages", ["receiver_id"], unique=False)
        op.create_index("ix_messages_receiver_id_unread", "messages", ["receiver_id"], unique=False, postgresql_where=sa.text("read = 0"))
        op.create_index("ix_messages_pinned", "messages", ["pinned"], unique=False)
        op.create_index("ix_messages_pinned_true", "messages", ["pinned"], unique=False, postgresql_where=sa.text("pinned = 1"))
        op.create_index("ix_messages_created_at", "messages", ["created_at"], unique=False)
        op.create_index("ix_message_reactions_message_id", "message_reactions", ["message_id"], unique=False)
        op.create_index("ix_friend_requests_sender_id", "friend_requests", ["sender_id"], unique=False)
        op.create_index("ix_friend_requests_receiver_id", "friend_requests", ["receiver_id"], unique=False)
        op.create_index("ix_forum_threads_author_id", "forum_threads", ["author_id"], unique=False)
        op.create_index("ix_forum_thread_votes_thread_id", "forum_thread_votes", ["thread_id"], unique=False)
        op.create_index("ix_forum_comments_thread_id", "forum_comments", ["thread_id"], unique=False)
        op.create_index("ix_chat_room_members_user_id", "chat_room_members", ["user_id"], unique=False)
        op.create_index("ix_chat_room_members_room_id", "chat_room_members", ["room_id"], unique=False)
        op.create_index("ix_article_subscriptions_user_id", "article_subscriptions", ["user_id"], unique=False)
        op.create_index("ix_article_comments_article_id", "article_comments", ["article_id"], unique=False)

        op.drop_column("post_comments", "video_duration")
        op.drop_column("post_comments", "video_poster_url")
        op.drop_column("post_comments", "video_url")
        op.drop_column("post_comments", "image_url")
        op.drop_column("forum_comments", "video_duration")
        op.drop_column("forum_comments", "video_poster_url")
        op.drop_column("forum_comments", "video_url")
        op.drop_column("forum_comments", "image_url")
        op.drop_column("article_comments", "video_duration")
        op.drop_column("article_comments", "video_poster_url")
        op.drop_column("article_comments", "video_url")
        op.drop_column("article_comments", "image_url")
    else:
        # SQLite downgrade via batch_alter_table
        with op.batch_alter_table("users", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_users_name"), ["name"], unique=False)
            batch_op.create_index(batch_op.f("ix_users_house"), ["house"], unique=False)
        with op.batch_alter_table("user_products", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_user_products_user_id"), ["user_id"], unique=False)
        with op.batch_alter_table("user_pet_items", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_user_pet_items_user_id"), ["user_id"], unique=False)
        with op.batch_alter_table("user_creatures", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_user_creatures_user_id"), ["user_id"], unique=False)
            batch_op.create_index(batch_op.f("ix_user_creatures_for_sale"), ["for_sale"], unique=False)
            batch_op.create_index(batch_op.f("ix_user_creatures_creature_id"), ["creature_id"], unique=False)
        with op.batch_alter_table("transactions", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_transactions_sender_id"), ["sender_id"], unique=False)
            batch_op.create_index(batch_op.f("ix_transactions_receiver_id"), ["receiver_id"], unique=False)
        with op.batch_alter_table("products", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_products_shop_category"), ["shop", "category"], unique=False)
        with op.batch_alter_table("posts", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_posts_created_at"), ["created_at"], unique=False)
            batch_op.create_index(batch_op.f("ix_posts_author_id"), ["author_id"], unique=False)
        with op.batch_alter_table("post_reposts", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_post_reposts_post_id"), ["post_id"], unique=False)
        with op.batch_alter_table("post_likes", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_post_likes_user_id"), ["user_id"], unique=False)
            batch_op.create_index(batch_op.f("ix_post_likes_post_id"), ["post_id"], unique=False)
        with op.batch_alter_table("post_comments", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_post_comments_post_id"), ["post_id"], unique=False)
            batch_op.drop_column("video_duration")
            batch_op.drop_column("video_poster_url")
            batch_op.drop_column("video_url")
            batch_op.drop_column("image_url")
        with op.batch_alter_table("notifications", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_notifications_user_id_read"), ["user_id", "read"], unique=False)
            batch_op.create_index(batch_op.f("ix_notifications_user_id_created_at"), ["user_id", "created_at"], unique=False)
            batch_op.create_index(batch_op.f("ix_notifications_user_id"), ["user_id"], unique=False)
        with op.batch_alter_table("messages", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_messages_sender_receiver_unread"), ["sender_id", "receiver_id"], unique=False, sqlite_where=sa.text("read = 0"))
            batch_op.create_index(batch_op.f("ix_messages_sender_id_receiver_id_created_at"), ["sender_id", "receiver_id", "created_at"], unique=False)
            batch_op.create_index(batch_op.f("ix_messages_sender_id"), ["sender_id"], unique=False)
            batch_op.create_index(batch_op.f("ix_messages_room_id_unread"), ["room_id"], unique=False, sqlite_where=sa.text("read = 0"))
            batch_op.create_index(batch_op.f("ix_messages_room_id_read"), ["room_id", "read"], unique=False)
            batch_op.create_index(batch_op.f("ix_messages_room_id_created_at"), ["room_id", "created_at"], unique=False)
            batch_op.create_index(batch_op.f("ix_messages_room_id"), ["room_id"], unique=False)
            batch_op.create_index(batch_op.f("ix_messages_receiver_id_unread"), ["receiver_id"], unique=False, sqlite_where=sa.text("read = 0"))
            batch_op.create_index(batch_op.f("ix_messages_receiver_id"), ["receiver_id"], unique=False)
            batch_op.create_index(batch_op.f("ix_messages_pinned_true"), ["pinned"], unique=False, sqlite_where=sa.text("pinned = 1"))
            batch_op.create_index(batch_op.f("ix_messages_pinned"), ["pinned"], unique=False)
            batch_op.create_index(batch_op.f("ix_messages_created_at"), ["created_at"], unique=False)
        with op.batch_alter_table("message_reactions", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_message_reactions_message_id"), ["message_id"], unique=False)
        with op.batch_alter_table("friend_requests", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_friend_requests_sender_id"), ["sender_id"], unique=False)
            batch_op.create_index(batch_op.f("ix_friend_requests_receiver_id"), ["receiver_id"], unique=False)
        with op.batch_alter_table("forum_threads", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_forum_threads_author_id"), ["author_id"], unique=False)
        with op.batch_alter_table("forum_thread_votes", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_forum_thread_votes_thread_id"), ["thread_id"], unique=False)
        with op.batch_alter_table("forum_comments", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_forum_comments_thread_id"), ["thread_id"], unique=False)
            batch_op.drop_column("video_duration")
            batch_op.drop_column("video_poster_url")
            batch_op.drop_column("video_url")
            batch_op.drop_column("image_url")
        with op.batch_alter_table("chat_room_members", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_chat_room_members_user_id"), ["user_id"], unique=False)
            batch_op.create_index(batch_op.f("ix_chat_room_members_room_id"), ["room_id"], unique=False)
        with op.batch_alter_table("article_subscriptions", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_article_subscriptions_user_id"), ["user_id"], unique=False)
        with op.batch_alter_table("article_comments", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_article_comments_article_id"), ["article_id"], unique=False)
            batch_op.drop_column("video_duration")
            batch_op.drop_column("video_poster_url")
            batch_op.drop_column("video_url")
            batch_op.drop_column("image_url")
