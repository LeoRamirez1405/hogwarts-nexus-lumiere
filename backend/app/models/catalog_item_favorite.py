import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from ..database import Base


class CatalogItemFavorite(Base):
    __tablename__ = "catalog_item_favorites"
    __table_args__ = (
        UniqueConstraint("user_id", "catalog_item_id", name="uq_user_catalog_item_fav"),
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    catalog_item_id = Column(String, ForeignKey("catalog_items.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    item = relationship("CatalogItem", back_populates="favorites")
