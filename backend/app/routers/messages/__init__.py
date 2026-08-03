"""Messages router package.

Aggregates the focused sub-routers into a single ``router`` and re-exports the
symbols other modules import from ``routers.messages`` (``serialize_message``
and ``_delete_attachment_file``).

Note: the generic ``/{user_id}`` catch-all lives in ``core``, which is included
LAST so the literal routes registered by earlier sub-routers (``/search``,
``/scheduled``, ``/conversations``, …) win over it. FastAPI/Starlette resolves
routes in registration order, so any router with a catch-all ``/{param}`` that
matches a single path segment must be included after every router exposing
literal single-segment GET routes.
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
from .link_preview import router as link_preview_router

router = APIRouter()
router.include_router(conversations_router)
router.include_router(rooms_router)
router.include_router(interactions_router)
router.include_router(media_router)
router.include_router(search_router)
router.include_router(admin_router)
router.include_router(scheduled_router)
router.include_router(export_router)
router.include_router(link_preview_router)
router.include_router(core_router)

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
