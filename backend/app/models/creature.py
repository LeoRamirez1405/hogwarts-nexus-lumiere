import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, Text

from ..database import Base


class Creature(Base):
    __tablename__ = "creatures"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    rarity = Column(String, nullable=False)  # common / uncommon / rare / legendary / ethereal
    pet_type = Column(String, nullable=False, default="critter")  # avian / beast / critter
    price = Column(Integer, nullable=False)
    image_url = Column(String, nullable=True)
    # Gating: minimum user (magic) level and/or sanctuary level required to
    # adopt or buy this creature. 0 / 1 means no real requirement.
    required_user_level = Column(Integer, nullable=False, default=1)
    required_sanctuary_level = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
