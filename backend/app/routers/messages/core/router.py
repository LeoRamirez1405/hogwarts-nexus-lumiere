"""Core message operations router.

Aggregates the focused sub-routers (send, edit, delete, pin, star, fetch,
forward) into a single ``router``.  The catch-all `/{user_id}` route lives in
`fetch`, which is included LAST so literal routes registered by earlier
sub-routers (`/starred`, `/rooms/{room_id}/pinned`, `/dm/{user_id}/pinned`,
`/{message_id}/…`) win over it.
"""

from fastapi import APIRouter

from .send import router as send_router
from .edit import router as edit_router
from .delete import router as delete_router
from .pin import router as pin_router
from .star import router as star_router
from .forward import router as forward_router
from .fetch import router as fetch_router

router = APIRouter()
router.include_router(send_router, tags=["messages"])
router.include_router(edit_router, tags=["messages"])
router.include_router(delete_router, tags=["messages"])
router.include_router(pin_router, tags=["messages"])
router.include_router(star_router, tags=["messages"])
router.include_router(forward_router, tags=["messages"])
router.include_router(fetch_router, tags=["messages"])  # catch-all LAST