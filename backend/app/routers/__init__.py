"""Backend API Routers."""

from . import auth
from . import users
from . import products
from . import articles
from . import creatures
from . import messages
from . import posts
from . import transactions
from . import dashboard
from . import friend_requests
from . import upload
from . import notifications
from . import pet_items
from . import support
from . import announcements
from . import classifieds
from . import forum
from . import enum_types
from . import feature_flags
from . import audit_logs
from . import ws_messages
from . import push
from . import voice_channels
from . import events
from .e2e import router as e2e_encryption

__all__ = [
    "auth",
    "users",
    "products",
    "articles",
    "creatures",
    "messages",
    "posts",
    "transactions",
    "dashboard",
    "friend_requests",
    "upload",
    "notifications",
    "pet_items",
    "support",
    "announcements",
    "classifieds",
    "forum",
    "enum_types",
    "feature_flags",
    "audit_logs",
    "ws_messages",
    "push",
    "voice_channels",
    "events",
    "e2e_encryption",
]