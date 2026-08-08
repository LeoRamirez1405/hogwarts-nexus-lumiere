import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from ..database import Base


class CatalogItem(Base):
    __tablename__ = "catalog_items"
    __table_args__ = (
        UniqueConstraint("catalog_id", "numero", name="uq_catalog_item_numero"),
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    catalog_id = Column(String, ForeignKey("catalogs.id", ondelete="CASCADE"), nullable=False, index=True)
    numero = Column(Integer, nullable=False)
    description = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    catalog = relationship("Catalog", back_populates="items")
    favorites = relationship("CatalogItemFavorite", back_populates="item", cascade="all, delete-orphan")
