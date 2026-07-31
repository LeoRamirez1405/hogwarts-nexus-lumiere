from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, Field


class AuditLogResponse(BaseModel):
    id: str
    actor_id: str
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime
    actor_name: Optional[str] = None

    class Config:
        from_attributes = True


class AuditLogPage(BaseModel):
    items: list[AuditLogResponse]
    total: int
    skip: int
    limit: int
    has_more: bool


# Action constants (match AuditAction enum)
class AuditAction:
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    LOGIN = "login"
    LOGOUT = "logout"
    PASSWORD_RESET = "password_reset"
    HOUSE_POINTS_ADJUST = "house_points_adjust"
    ROLE_CHANGE = "role_change"
    BATCH_ADD_MEMBERS = "batch_add_members"
    TOGGLE_FEATURE = "toggle_feature"
    UNKNOWN = "unknown"