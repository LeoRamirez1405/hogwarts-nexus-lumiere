import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from ..database import Base


class UserCreature(Base):
    __tablename__ = "user_creatures"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    creature_id = Column(String, ForeignKey("creatures.id"), nullable=False)
    # Nombre personalizado que el usuario elige al adoptar (independiente de la especie).
    pet_name = Column(String, nullable=True)
    level = Column(Integer, default=1, nullable=False)
    hunger = Column(Integer, default=50, nullable=False)
    happiness = Column(Integer, default=50, nullable=False)
    adopted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    # Timestamp of the last time hunger/happiness were settled against elapsed
    # time. Decay is applied lazily on read/mutation from this marker.
    last_decay_at = Column(DateTime, default=datetime.utcnow, nullable=True)
    # True once the "your pet is very old" heads-up has been sent, so the
    # farewell warning is only delivered once.
    farewell_warned = Column(Boolean, default=False, nullable=False)
    # True once the "your pet needs attention" heads-up has been sent; reset when
    # the owner feeds/plays so the reminder can fire again on the next lapse.
    attention_warned = Column(Boolean, default=False, nullable=False)
    # True once the "your pet is about to escape" warning has been sent.
    escaped_warned = Column(Boolean, default=False, nullable=False)
    # When either hunger or happiness hit 0, this timestamp is set. If the stat
    # stays at 0 for PET_ESCAPE_GRACE_HOURS, the pet escapes.
    last_critical_at = Column(DateTime, nullable=True)
    # Resale: when for_sale is True the pet is listed in the market at sale_price.
    for_sale = Column(Boolean, default=False, nullable=False)
    sale_price = Column(Integer, nullable=True)

    user = relationship("User", back_populates="creatures", lazy="selectin")
    creature = relationship("Creature", lazy="selectin")

    MAX_LEVEL = 11

    @property
    def mood(self) -> str:
        if self.hunger == 0 and self.happiness == 0:
            return "crítico"
        if self.hunger <= 20:
            return "hambriento"
        if self.happiness <= 20:
            return "triste"
        if self.hunger >= 80 and self.happiness >= 80:
            return "feliz"
        return "bien"

    @property
    def is_critical(self) -> bool:
        """Returns True if either hunger or happiness is at or below the critical threshold."""
        from ..config import settings
        return self.hunger <= settings.PET_CRITICAL_THRESHOLD or self.happiness <= settings.PET_CRITICAL_THRESHOLD

    @property
    def level_name(self) -> str:
        from ..pet_progress import pet_level_name
        return pet_level_name(self.level)

    @property
    def age_days(self) -> int:
        from ..pet_progress import pet_age_days
        return int(pet_age_days(self.adopted_at))

    @property
    def stage(self) -> str:
        from ..pet_progress import pet_stage
        return pet_stage(self.adopted_at)
