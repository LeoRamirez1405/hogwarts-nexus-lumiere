import uuid

from sqlalchemy import Column, String, DateTime, Boolean, UniqueConstraint, ForeignKey
from sqlalchemy.orm import relationship

from ..database import Base
from app.utils.dates import utcnow


class EnumCategory(Base):
    """Groups enum values by domain (e.g., 'pet_type', 'rarity', 'house')."""

    __tablename__ = "enum_categories"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String, nullable=False, unique=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    is_system = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    values = relationship(
        "EnumValue",
        back_populates="category",
        lazy="selectin",
        cascade="all, delete-orphan",
    )


class EnumValue(Base):
    """Individual enum value within a category."""

    __tablename__ = "enum_values"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    category_id = Column(
        String, ForeignKey("enum_categories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label = Column(String, nullable=False, index=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    category = relationship("EnumCategory", back_populates="values")

    __table_args__ = (
        UniqueConstraint("category_id", "label", name="uq_enum_value_category_label"),
    )