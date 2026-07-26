import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship

from ..database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    sender_id = Column(String, ForeignKey("users.id"), nullable=True)
    receiver_id = Column(String, ForeignKey("users.id"), nullable=True)
    amount = Column(Integer, nullable=False)
    type = Column(String, nullable=False)  # deposit / withdrawal / transfer / purchase
    description = Column(Text, nullable=True)
    status = Column(String, default="confirmed", nullable=False)  # pending / confirmed / completed
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    sender = relationship("User", foreign_keys=[sender_id], back_populates="transactions_sent", lazy="selectin")
    receiver = relationship("User", foreign_keys=[receiver_id], back_populates="transactions_received", lazy="selectin")
