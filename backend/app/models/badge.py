import uuid

from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from ..database import Base
from app.utils.dates import utcnow


class UserBadge(Base):
    """Insignia desbloqueada por un usuario (primer completador, foil, streak...).

    ``badge_key`` identifica el tipo de insignia (unico por usuario); ``label``
    e ``icon`` son copias denormalizadas para no depender de un catalogo.
    """

    __tablename__ = "user_badges"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    badge_key = Column(String, nullable=False)
    label = Column(String, nullable=False)
    icon = Column(String, nullable=True)
    granted_at = Column(DateTime, default=utcnow, nullable=False)

    user = relationship("User", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("user_id", "badge_key", name="uq_user_badge_key"),
    )