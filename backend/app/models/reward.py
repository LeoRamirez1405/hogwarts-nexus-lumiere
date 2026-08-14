import uuid

from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship

from ..database import Base
from app.utils.dates import utcnow


class AdminReward(Base):
    """Recompensa de admin: un sobre (o varios) para un usuario.

    Los admins NUNCA dan Zerines ni figuritas directas; solo sobres.
    """

    __tablename__ = "admin_rewards"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    admin_id = Column(String, ForeignKey("users.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    pack_type_id = Column(String, ForeignKey("pack_types.id"), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    admin = relationship("User", lazy="selectin", foreign_keys=[admin_id])
    user = relationship("User", lazy="selectin", foreign_keys=[user_id])
    pack_type = relationship("PackType", lazy="selectin")