import uuid

from sqlalchemy import Column, String, Integer, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from ..database import Base
from app.utils.dates import utcnow


class RouletteConfig(Base):
    """Configuracion global de la ruleta (una sola fila activa).

    segmentos: JSON string con premios + pesos, ej:
    [{"prize": "pack:1", "weight": 30}, {"prize": "jackpot", "weight": 2}]
    """

    __tablename__ = "roulette_configs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    cost_zerines = Column(Integer, default=100, nullable=False)
    segments = Column(Text, nullable=True)
    enabled = Column(Boolean, default=True, nullable=False)
    updated_by = Column(String, ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    updater = relationship("User", lazy="selectin")


class RouletteSpin(Base):
    """Historial/auditoria de cada giro: que pago y que salio."""

    __tablename__ = "roulette_spins"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    cost = Column(Integer, nullable=False)
    # JSON string: {"prize": "pack:2", "label": "2 Sobres", "pack_type_id": "..."}
    result_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    user = relationship("User", lazy="selectin")