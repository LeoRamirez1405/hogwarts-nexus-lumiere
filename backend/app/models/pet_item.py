import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, Text

from ..database import Base


class PetItem(Base):
    """Catalog of consumable pet supplies (food / toys).

    A single purchase grants `pack_size` units into the buyer's inventory.
    Each use (feed / play) consumes one unit and restores `restore_amount`
    to the matching stat (hunger for food, happiness for toys). Pricier
    items are simply seeded/configured with a larger `restore_amount`.
    """

    __tablename__ = "pet_items"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    kind = Column(String, nullable=False)  # food / toy
    pet_type = Column(String, nullable=False)
    price = Column(Integer, nullable=False)
    restore_amount = Column(Integer, default=10, nullable=False)  # per single use
    pack_size = Column(Integer, default=1, nullable=False)  # units granted per purchase
    image_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
