"""Serialization helpers and conversation-list building for the messages router.

This module now delegates to the ``serializers/`` sub-package.  Import from
``serializers.message`` (``serialize_message``, ``serialize_poll``,
``serialize_room``, ``_preview_message``), ``serializers.conversation``
(``build_conversations``), and ``services.messages.conversation_prefs``
(``_update_conversation_preferences``, ``_upsert_conversation_pref``).
"""

from .serializers.message import _preview_message, serialize_message, serialize_poll, serialize_room  # noqa: F401
from .serializers.conversation import build_conversations  # noqa: F401
from ..services.messages.conversation_prefs import _update_conversation_preferences, _upsert_conversation_pref  # noqa: F401