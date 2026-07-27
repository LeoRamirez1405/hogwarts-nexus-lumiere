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
    # Timestamp of the last time hunger/happiness were settled against elapsed
    # time. Decay is applied lazily on read/mutation from this marker.
    last_decay_at = Column(DateTime, default=datetime.utcnow, nullable=True)

    user = relationship("User", back_populates="creatures", lazy="selectin")
    creature = relationship("Creature", lazy="selectin")

    @property
    def mood(self) -> str:
        if self.hunger <= 20:
            return "hambriento"
        if self.happiness <= 20:
            return "triste"
        if self.hunger >= 80 and self.happiness >= 80:
            return "feliz"
        return "bien"
