import uuid

from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from ..database import Base
from app.utils.dates import utcnow


class UserProduct(Base):
    __tablename__ = "user_products"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    specification = Column(Text, nullable=True)
    purchased_at = Column(DateTime, default=utcnow, nullable=False)

    user = relationship("User", lazy="selectin")
    product = relationship("Product", lazy="selectin")
