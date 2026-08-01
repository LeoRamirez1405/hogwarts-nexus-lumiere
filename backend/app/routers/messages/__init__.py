"""Messages router package.

Aggregates the focused sub-routers into a single ``router`` and re-exports the
symbols other modules import from ``routers.messages`` (``serialize_message``
and ``_delete_attachment_file``).

Note: sub-router include order deliberately mirrors the original flat file's
route-registration order so path matching behaviour (including which literal
routes shadow the generic ``/{user_id}`` catch-all) is preserved exactly.
"""

from fastapi import APIRouter

from .conversations import router as conversations_router
from .rooms import router as rooms_router
from .core import router as core_router
from .interactions import router as interactions_router
from .media import router as media_router
from .search import router as search_router
from .admin import router as admin_router
from .scheduled import router as scheduled_router
from .export import router as export_router

router = APIRouter()
router.include_router(conversations_router)
router.include_router(rooms_router)
router.include_router(core_router)
router.include_router(interactions_router)
router.include_router(media_router)
router.include_router(search_router)
router.include_router(admin_router)
router.include_router(scheduled_router)
router.include_router(export_router)

# Re-export symbols the rest of the app imports from routers.messages.
from .deps import _close_redis, _delete_attachment_file, get_redis  # noqa: E402
from .serializers import serialize_message  # noqa: E402

__all__ = [
    "router",
    "serialize_message",
    "_delete_attachment_file",
    "_close_redis",
    "get_redis",
]
