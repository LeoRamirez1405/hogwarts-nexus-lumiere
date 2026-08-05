"""Admin-only audit log routes (prefix /admin/audit-logs)."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...database import get_db
from ...middleware.roles import require_role
from ...models.audit_log import AuditLog
from ...models.user import User
from ...schemas.audit_log import AuditLogPage, AuditLogResponse

router = APIRouter(prefix="/admin/audit-logs", tags=["admin-audit-logs"])


@router.get("", response_model=AuditLogPage)
async def list_audit_logs(
    actor_id: Optional[str] = Query(None, description="Filter by actor ID"),
    action: Optional[str] = Query(None, description="Filter by action (e.g. create, update, delete)"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type (e.g. User, Article)"),
    entity_id: Optional[str] = Query(None, description="Filter by entity ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    query = select(AuditLog).options(selectinload(AuditLog.actor)).order_by(desc(AuditLog.created_at))
    count_query = select(func.count(AuditLog.id))

    filters = []
    if actor_id:
        filters.append(AuditLog.actor_id == actor_id)
    if action:
        filters.append(AuditLog.action == action)
    if entity_type:
        filters.append(AuditLog.entity_type == entity_type)
    if entity_id:
        filters.append(AuditLog.entity_id == entity_id)

    if filters:
        query = query.where(and_(*filters))
        count_query = count_query.where(and_(*filters))

    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    result = await db.execute(query.offset(skip).limit(limit + 1))
    items = result.scalars().all()
    has_more = len(items) > limit
    items = items[:limit]

    # Enrich with actor name
    enriched = []
    for log in items:
        enriched.append(
            AuditLogResponse(
                id=log.id,
                actor_id=log.actor_id,
                action=log.action,
                entity_type=log.entity_type,
                entity_id=log.entity_id,
                details=log.details,
                ip_address=log.ip_address,
                user_agent=log.user_agent,
                created_at=log.created_at,
                actor_name=log.actor.name if log.actor else None,
            )
        )

    return AuditLogPage(
        items=enriched,
        total=total,
        skip=skip,
        limit=limit,
        has_more=has_more,
    )


@router.get("/{log_id}", response_model=AuditLogResponse)
async def get_audit_log(
    log_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(
        select(AuditLog).options(selectinload(AuditLog.actor)).where(AuditLog.id == log_id)
    )
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Audit log not found")

    return AuditLogResponse(
        id=log.id,
        actor_id=log.actor_id,
        action=log.action,
        entity_type=log.entity_type,
        entity_id=log.entity_id,
        details=log.details,
        ip_address=log.ip_address,
        user_agent=log.user_agent,
        created_at=log.created_at,
        actor_name=log.actor.name if log.actor else None,
    )
