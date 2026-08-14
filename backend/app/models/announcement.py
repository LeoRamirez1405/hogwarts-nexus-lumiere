import uuid

from sqlalchemy import Column, String, DateTime, Text

from ..database import Base
from app.utils.dates import utcnow


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
