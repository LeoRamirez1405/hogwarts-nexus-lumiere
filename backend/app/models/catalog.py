import uuid

from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.orm import relationship

from ..database import Base
from app.utils.dates import utcnow


class Catalog(Base):
    __tablename__ = "catalogs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    cover_image_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    items = relationship("CatalogItem", back_populates="catalog", cascade="all, delete-orphan")
