"""Creatures router package.

Aggregates the focused sub-routers into a single ``router``. Include order
deliberately preserves the original flat file's route-registration order for
path matching: the literal routes (``/my``, ``/stats``, ``/market``,
``/my-full-state``) are registered before the ``GET /{creature_id}`` catch-all
so they are not shadowed.
"""

from fastapi import APIRouter

from .my_creatures import router as my_creatures_router
from .stats import router as stats_router
from .market import router as market_router
from .catalog import router as catalog_router
from .interactions import router as interactions_router

router = APIRouter()
router.include_router(my_creatures_router)
router.include_router(stats_router)
router.include_router(market_router)
router.include_router(catalog_router)
router.include_router(interactions_router)

__all__ = ["router"]
