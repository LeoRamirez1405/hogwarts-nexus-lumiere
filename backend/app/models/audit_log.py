import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import relationship

from ..database import Base


class AuditAction(str, Enum):
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


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    actor_id = Column(String, ForeignKey("users.id"), nullable=False)  # who did it
    action = Column(String, nullable=False)  # AuditAction value
    entity_type = Column(String, nullable=False)  # e.g. "User", "Article", "ChatRoom"
    entity_id = Column(String, nullable=True)  # ID of affected entity
    details = Column(Text, nullable=True)  # JSON string with before/after or context
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    actor = relationship("User", lazy="selectin", foreign_keys=[actor_id])

    __table_args__ = (
        Index("ix_audit_logs_actor_id_created_at", "actor_id", "created_at"),
        Index("ix_audit_logs_entity", "entity_type", "entity_id"),
        Index("ix_audit_logs_action_created_at", "action", "created_at"),
    )