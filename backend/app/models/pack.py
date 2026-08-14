import enum
import uuid

from sqlalchemy import Column, String, Integer, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from ..database import Base
from app.utils.dates import utcnow


class PackOrigin(str, enum.Enum):
    PURCHASE = "purchase"
    REWARD = "reward"
    ROULETTE = "roulette"
    DAILY = "daily"


class PackType(Base):
    """Tipo de sobre: precio, cantidad de cartas y pesos de rareza (JSON)."""

    __tablename__ = "pack_types"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    price_zerines = Column(Integer, nullable=False)
    num_cards = Column(Integer, nullable=False)
    # JSON string: {"common": 55, "rare": 25, "ultra_rare": 12, "special": 6, "legendary": 2}
    rarity_weights = Column(Text, nullable=True)
    enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class UserPack(Base):
    """Sobre en la bandeja del usuario (comprado, premiado o de la ruleta).

    Se abre cuando el usuario quiere; album_id se congela al crearlo para que
    un sobre de una edicion vieja abra cartas de esa edicion.
    """

    __tablename__ = "user_packs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    pack_type_id = Column(String, ForeignKey("pack_types.id"), nullable=False)
    album_id = Column(String, ForeignKey("albums.id"), nullable=False, index=True)
    origin = Column(String, default=PackOrigin.PURCHASE.value, nullable=False)
    opened = Column(Boolean, default=False, nullable=False)
    # Si la ruleta/adm lo fija, la carta del sobre se garantiza de esa rareza.
    forced_rarity = Column(String, nullable=True)
    # JSON string con las cartas que salieron al abrir (card_id + quantity).
    result_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    opened_at = Column(DateTime, nullable=True)

    user = relationship("User", lazy="selectin")
    pack_type = relationship("PackType", lazy="selectin")
    album = relationship("Album", lazy="selectin")