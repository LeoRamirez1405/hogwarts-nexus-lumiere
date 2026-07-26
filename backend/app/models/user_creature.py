import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from ..database import Base


class UserCreature(Base):
    __tablename__ = "user_creatures"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    creature_id = Column(String, ForeignKey("creatures.id"), nullable=False)
    level = Column(Integer, default=1, nullable=False)
    hunger = Column(Integer, default=50, nullable=False)
    happiness = Column(Integer, default=50, nullable=False)
    adopted_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="creatures", lazy="selectin")
    creature = relationship("Creature", lazy="selectin")
