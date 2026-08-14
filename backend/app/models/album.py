import enum
import uuid

from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from ..database import Base
from app.utils.dates import utcnow


class AlbumStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"


class CardRarity(str, enum.Enum):
    COMMON = "common"
    RARE = "rare"
    ULTRA_RARE = "ultra_rare"
    SPECIAL = "special"
    LEGENDARY = "legendary"


class Album(Base):
    __tablename__ = "albums"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    cover_url = Column(String, nullable=True)
    status = Column(String, default=AlbumStatus.DRAFT.value, nullable=False)
    # Rotacion de 2 semanas: el admin define la tematica de cada edicion.
    starts_at = Column(DateTime, nullable=True)
    ends_at = Column(DateTime, nullable=True)
    # Primer jugador en completar el album (badge + premio unico).
    first_completed_by = Column(String, ForeignKey("users.id"), nullable=True)
    first_completed_at = Column(DateTime, nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    creator = relationship("User", lazy="selectin", foreign_keys=[created_by])
    first_completer = relationship("User", lazy="selectin", foreign_keys=[first_completed_by])
    cards = relationship("AlbumCard", back_populates="album", cascade="all, delete-orphan", lazy="selectin")


class AlbumCard(Base):
    __tablename__ = "album_cards"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    album_id = Column(String, ForeignKey("albums.id"), nullable=False, index=True)
    # Slot fijo 1-25: la grilla es inmutable, cada carta vive en su posicion.
    slot_number = Column(Integer, nullable=False)
    title = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    rarity = Column(String, default=CardRarity.COMMON.value, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    album = relationship("Album", back_populates="cards", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("album_id", "slot_number", name="uq_album_slot"),
    )