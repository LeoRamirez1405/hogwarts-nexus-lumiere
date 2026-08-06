"""Shared audit logging helper.

The admin-only endpoints previously defined here live in
``routers.admin.audit_logs`` (prefix /admin/audit-logs). This module keeps
the ``log_audit`` helper that other routers import.
"""

from typing import Any, Dict, Optional
from datetime import date, datetime
from uuid import UUID

import json

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.audit_log import AuditLog
from ..models.user import User


def _json_default(obj: Any) -> str:
    """JSON serializer fallback for values that plain json.dumps rejects
    (datetimes, UUIDs, etc.) so audit details never blow up the request."""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, UUID):
        return str(obj)
    return str(obj)


def _extract_ip(request: Request) -> str:
    """Extract client IP from request, handling proxies."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def log_audit(
    db: AsyncSession,
    actor: User,
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> AuditLog:
    """Helper to create an audit log entry."""
    log = AuditLog(
        actor_id=actor.id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=json.dumps(details, default=_json_default) if details else None,
        ip_address=_extract_ip(request) if request else None,
        user_agent=request.headers.get("User-Agent") if request else None,
    )
    db.add(log)
    # Commit immediately: the caller's session closes without committing after
    # the request, so a plain flush() would silently roll the entry back.
    await db.commit()
    return log


__all__ = ["log_audit"]
