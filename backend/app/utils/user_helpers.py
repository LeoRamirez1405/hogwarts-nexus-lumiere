"""Shared helpers for user serialization (magic level enrichment) and
cascade deletion. Used by both the public users router and the admin
users router."""

from typing import List

from sqlalchemy import delete, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.article import Article, ArticleComment
from ..models.article_subscription import ArticleSubscription, Notification
from ..models.audit_log import AuditLog
from ..models.chat_room import ChatRoom, ChatRoomMember, RoomInvite, UserConversationPreference
from ..models.e2e_encryption import (
    EncryptedMessage,
    SafetyNumber,
    Session,
    UserIdentityKey,
    UserPreKey,
    UserSignedPreKey,
)
from ..models.event import (
    Event,
    EventAnimationSeen,
    EventReminder,
    EventRSVP,
    EventVisibilitySettings,
)
from ..models.forum import ForumThread, ForumThreadVote, ForumComment, ForumSubscription
from ..models.friend_request import FriendRequest
from ..models.message import Message, Poll, PollOption, PollVote, MessageReaction
from ..models.post import Post, PostLike, PostRepost, PostComment
from ..models.push_subscription import PushSubscription
from ..models.transaction import Transaction
from ..models.user import User
from ..models.user_creature import UserCreature
from ..models.user_pet_item import UserPetItem
from ..models.user_product import UserProduct
from ..models.voice_channel import VoiceChannel, VoiceChannelParticipant
from .magic_level import get_magic_level, get_magic_levels


async def enrich_user(db: AsyncSession, user: User, level_data: dict | None = None) -> dict:
    data = {c.name: getattr(user, c.name) for c in user.__table__.columns}
    data["magic_level"] = level_data or await get_magic_level(db, user)
    return data


async def enrich_users(db: AsyncSession, users: List[User]) -> List[dict]:
    """Enrich a page of users computing every magic level with ~5 GROUP BY queries."""
    levels = await get_magic_levels(db, users)
    return [
        {**{c.name: getattr(u, c.name) for c in u.__table__.columns}, "magic_level": levels.get(u.id)}
        for u in users
    ]


async def delete_user_relations(db: AsyncSession, user_id: str) -> None:
    """Remove every row that references a user before deleting them.

    The ORM's ``lazy="raise"`` collection relationships plus the FK graph
    (posts, messages, transactions, notifications, chat rooms, …) make a bare
    ``db.delete(user)`` fail. Children are removed explicitly, in dependency
    order, so deletion works on both SQLite (dev) and Postgres (prod).
    """
    rooms_created = select(ChatRoom.id).where(ChatRoom.created_by == user_id)
    user_posts = select(Post.id).where(or_(Post.author_id == user_id, Post.edited_by == user_id))
    user_threads = select(ForumThread.id).where(ForumThread.author_id == user_id)
    user_articles = select(Article.id).where(Article.author_id == user_id)
    involved_messages = select(Message.id).where(or_(
        Message.sender_id == user_id,
        Message.receiver_id == user_id,
        Message.room_id.in_(rooms_created),
    ))

    # Messages (and their poll / reaction children) referencing the user or
    # living in rooms the user created.
    await db.execute(delete(MessageReaction).where(or_(
        MessageReaction.user_id == user_id,
        MessageReaction.message_id.in_(involved_messages),
    )))
    polls_of_msgs = select(Poll.id).where(Poll.message_id.in_(involved_messages))
    await db.execute(delete(PollVote).where(or_(
        PollVote.user_id == user_id,
        PollVote.poll_id.in_(polls_of_msgs),
    )))
    await db.execute(delete(PollOption).where(PollOption.poll_id.in_(select(Poll.id).where(Poll.message_id.in_(involved_messages)))))
    await db.execute(delete(Poll).where(Poll.message_id.in_(involved_messages)))
    # Null out self-references so remaining messages don't point at deleted ones.
    await db.execute(
        update(Message).where(Message.reply_to_id.in_(involved_messages)).values(reply_to_id=None)
    )
    await db.execute(delete(EncryptedMessage).where(or_(
        EncryptedMessage.sender_id == user_id,
        EncryptedMessage.recipient_id == user_id,
        EncryptedMessage.message_id.in_(involved_messages),
    )))
    await db.execute(delete(Message).where(Message.id.in_(involved_messages)))

    # Notifications the user received or triggered.
    await db.execute(delete(Notification).where(or_(
        Notification.user_id == user_id,
        Notification.actor_id == user_id,
    )))

    # Posts (authored or edited) and their likes / reposts / comments.
    await db.execute(delete(PostLike).where(or_(
        PostLike.user_id == user_id,
        PostLike.post_id.in_(user_posts),
    )))
    await db.execute(delete(PostRepost).where(or_(
        PostRepost.user_id == user_id,
        PostRepost.post_id.in_(user_posts),
    )))
    await db.execute(delete(PostComment).where(or_(
        PostComment.user_id == user_id,
        PostComment.post_id.in_(user_posts),
    )))
    await db.execute(delete(Post).where(Post.id.in_(user_posts)))

    # Articles (authored) and their comments / subscriptions.
    await db.execute(delete(ArticleComment).where(or_(
        ArticleComment.user_id == user_id,
        ArticleComment.article_id.in_(user_articles),
    )))
    await db.execute(delete(ArticleSubscription).where(or_(
        ArticleSubscription.user_id == user_id,
        ArticleSubscription.article_id.in_(user_articles),
    )))
    await db.execute(delete(Article).where(Article.author_id == user_id))

    # Forum threads (authored) and their votes / comments / subscriptions.
    await db.execute(delete(ForumThreadVote).where(or_(
        ForumThreadVote.user_id == user_id,
        ForumThreadVote.thread_id.in_(user_threads),
    )))
    await db.execute(delete(ForumComment).where(or_(
        ForumComment.user_id == user_id,
        ForumComment.thread_id.in_(user_threads),
    )))
    await db.execute(delete(ForumSubscription).where(or_(
        ForumSubscription.user_id == user_id,
        ForumSubscription.thread_id.in_(user_threads),
    )))
    await db.execute(delete(ForumThread).where(ForumThread.id.in_(user_threads)))

    # Pets, inventory, purchases and money.
    await db.execute(delete(UserCreature).where(UserCreature.user_id == user_id))
    await db.execute(delete(UserPetItem).where(UserPetItem.user_id == user_id))
    await db.execute(delete(UserProduct).where(UserProduct.user_id == user_id))
    await db.execute(delete(Transaction).where(or_(
        Transaction.sender_id == user_id,
        Transaction.receiver_id == user_id,
    )))

    # Social graph.
    await db.execute(delete(FriendRequest).where(or_(
        FriendRequest.sender_id == user_id,
        FriendRequest.receiver_id == user_id,
    )))

    # Chat rooms the user created (memberships + members are cleaned too),
    # plus their plain memberships and conversation preferences.
    # Invites must go first: they reference both the user and the rooms.
    await db.execute(delete(RoomInvite).where(or_(
        RoomInvite.created_by == user_id,
        RoomInvite.room_id.in_(rooms_created),
    )))
    await db.execute(delete(ChatRoomMember).where(or_(
        ChatRoomMember.user_id == user_id,
        ChatRoomMember.room_id.in_(rooms_created),
    )))
    await db.execute(delete(UserConversationPreference).where(UserConversationPreference.user_id == user_id))
    await db.execute(delete(ChatRoom).where(ChatRoom.created_by == user_id))

    # Voice channels the user created (participants too) and their memberships.
    user_voice_channels = select(VoiceChannel.id).where(VoiceChannel.created_by == user_id)
    await db.execute(delete(VoiceChannelParticipant).where(or_(
        VoiceChannelParticipant.user_id == user_id,
        VoiceChannelParticipant.channel_id.in_(user_voice_channels),
    )))
    await db.execute(delete(VoiceChannel).where(VoiceChannel.id.in_(user_voice_channels)))

    # Events the user created/cancelled plus their RSVPs, reminders and
    # animation tracking. Events are attached to chat rooms the user created,
    # so they must be removed here too.
    user_events = select(Event.id).where(or_(
        Event.created_by == user_id,
        Event.cancelled_by == user_id,
    ))
    await db.execute(delete(EventRSVP).where(or_(
        EventRSVP.user_id == user_id,
        EventRSVP.event_id.in_(user_events),
    )))
    await db.execute(delete(EventReminder).where(or_(
        EventReminder.user_id == user_id,
        EventReminder.event_id.in_(user_events),
    )))
    await db.execute(delete(EventAnimationSeen).where(or_(
        EventAnimationSeen.user_id == user_id,
        EventAnimationSeen.event_id.in_(user_events),
    )))
    await db.execute(delete(EventVisibilitySettings).where(EventVisibilitySettings.updated_by == user_id))
    await db.execute(delete(Event).where(Event.id.in_(user_events)))

    # Push subscriptions (Web Push API).
    await db.execute(delete(PushSubscription).where(PushSubscription.user_id == user_id))

    # E2E encryption keys and sessions. Sessions reference prekeys, so delete
    # them before the keys they point to.
    user_identity = select(UserIdentityKey.id).where(UserIdentityKey.user_id == user_id)
    await db.execute(delete(Session).where(or_(
        Session.user_id == user_id,
        Session.remote_user_id == user_id,
    )))
    await db.execute(delete(SafetyNumber).where(or_(
        SafetyNumber.user_id == user_id,
        SafetyNumber.remote_user_id == user_id,
    )))
    await db.execute(delete(UserPreKey).where(UserPreKey.identity_id.in_(user_identity)))
    await db.execute(delete(UserSignedPreKey).where(UserSignedPreKey.identity_id.in_(user_identity)))
    await db.execute(delete(UserIdentityKey).where(UserIdentityKey.user_id == user_id))

    # Audit logs (actor is always an admin, but keep the FK graph consistent).
    await db.execute(delete(AuditLog).where(AuditLog.actor_id == user_id))
