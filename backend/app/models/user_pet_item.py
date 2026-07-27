import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from ..database import Base


class UserPetItem(Base):
    """A user's owned quantity of a given pet item (inventory row)."""

    __tablename__ = "user_pet_items"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    pet_item_id = Column(String, ForeignKey("pet_items.id"), nullable=False)
    quantity = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    pet_item = relationship("PetItem", lazy="selectin")
