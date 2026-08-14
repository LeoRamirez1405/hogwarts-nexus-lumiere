import uuid

from sqlalchemy import Column, String, DateTime

from ..database import Base
from app.utils.dates import utcnow


class Classified(Base):
    __tablename__ = "classifieds"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False)
    price = Column(String, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
