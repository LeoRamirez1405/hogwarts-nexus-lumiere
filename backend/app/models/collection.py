import uuid

from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from ..database import Base
from app.utils.dates import utcnow


class UserCard(Base):
    """Coleccion de un usuario: solo referencias enteras, sin imagenes.

    La foto de cada figurita vive una unica vez en AlbumCard.image_url; aqui
    solo se cuenta cuantas veces posee el usuario cada carta.
    """

    __tablename__ = "user_cards"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    album_id = Column(String, ForeignKey("albums.id"), nullable=False, index=True)
    card_id = Column(String, ForeignKey("album_cards.id"), nullable=False, index=True)
    quantity = Column(Integer, default=1, nullable=False)
    # Variante foil dorada (1%): la carta se "mejora" a foil si ya era poseida.
    foil = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    user = relationship("User", lazy="selectin")
    card = relationship("AlbumCard", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("user_id", "card_id", name="uq_user_card"),
    )


class UserAlbumCompletion(Base):
    """Registro de album completado por un usuario (fuente de XP).

    Una fila por (user_id, album_id): permite contar "albums completados"
    en el XP del nivel magico y evita re-premiar al re-abrir sobres.
    """

    __tablename__ = "user_album_completions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    album_id = Column(String, ForeignKey("albums.id"), nullable=False, index=True)
    completed_at = Column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "album_id", name="uq_user_album_completion"),
    )