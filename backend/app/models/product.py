import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, Text

from ..database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Integer, nullable=False)
    category = Column(String, nullable=True)
    shop = Column(String, nullable=False)  # borgin / flourish
    image_url = Column(String, nullable=True)
    stock = Column(Integer, default=0, nullable=False)
    weekly_sales = Column(Integer, default=0, nullable=False)
    specification_placeholder = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
