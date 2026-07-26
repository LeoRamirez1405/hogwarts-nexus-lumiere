import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from ..database import Base


class Article(Base):
    __tablename__ = "articles"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    author_id = Column(String, ForeignKey("users.id"), nullable=False)
    category = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    featured = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    author = relationship("User", back_populates="articles", lazy="selectin")
    subscriptions = relationship("ArticleSubscription", back_populates="article", lazy="selectin")
