import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Text, DateTime
from ..database import Base


class FeatureFlag(Base):
    __tablename__ = "feature_flags"

    key = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    enabled = Column(Boolean, default=True, nullable=False)
    category = Column(String, nullable=True)
    hidden = Column(Boolean, default=False, server_default="0", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)