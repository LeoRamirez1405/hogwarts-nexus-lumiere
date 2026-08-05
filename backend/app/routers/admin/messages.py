"""Admin-only message routes (prefix /admin/messages)."""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from ...config import settings
from ...middleware.roles import require_role
from ...models.user import User

router = APIRouter(prefix="/admin/messages", tags=["admin-messages"])


@router.post("/purge")
async def admin_purge_messages(
    days: Optional[int] = Query(None, ge=0),
    current_user: User = Depends(require_role("admin")),
):
    """Manually run the retention sweep. `days` overrides the configured
    window for this run; omit to use MESSAGE_RETENTION_DAYS."""
    from ...retention import purge_old_messages

    effective = settings.MESSAGE_RETENTION_DAYS if days is None else days
    result = await purge_old_messages(effective)
    return {"requested_days": effective, **result}
