"""Rooms router package.

Splits the former 746-line ``rooms.py`` into focused sub-routers. The original
``from .rooms import router`` import path used by the messages package
``__init__`` keeps working because this package exposes the aggregated
``router``.

Include order intentionally mirrors the original flat file's registration
order so route-matching behaviour is preserved. Note that there is no
catch-all shadowing risk here: ``GET /rooms/{room_id}`` only matches
two-segment paths, while all other room routes have additional literal
segments after ``{room_id}``.
"""

from fastapi import APIRouter

from .listing import router as listing_router
from .catalog import router as catalog_router
from .messages import router as messages_router
from .members import router as members_router
from .preferences import router as preferences_router
from .invites import router as invites_router

router = APIRouter()
router.include_router(listing_router)
router.include_router(catalog_router)
router.include_router(messages_router)
router.include_router(members_router)
router.include_router(preferences_router)
router.include_router(invites_router)

__all__ = ["router"]
