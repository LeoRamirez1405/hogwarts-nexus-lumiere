import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, LargeBinary, Text, Boolean, UniqueConstraint, Index
from sqlalchemy.orm import relationship

from ..database import Base


class UserIdentityKey(Base):
    __tablename__ = "user_identity_keys"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    identity_key_public = Column(LargeBinary, nullable=False)  # X25519 public key (32 bytes)
    identity_key_private = Column(LargeBinary, nullable=False)  # X25519 private key (32 bytes) - encrypted at rest
    registration_id = Column(Integer, nullable=False)  # 16-bit registration ID
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", lazy="selectin")
    prekeys = relationship("UserPreKey", back_populates="identity", cascade="all, delete-orphan", lazy="selectin")
    signed_prekey = relationship("UserSignedPreKey", back_populates="identity", cascade="all, delete-orphan", lazy="selectin", uselist=False)


class UserPreKey(Base):
    __tablename__ = "user_prekeys"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    identity_id = Column(String, ForeignKey("user_identity_keys.id"), nullable=False, index=True)
    prekey_id = Column(Integer, nullable=False)  # 16-bit prekey ID
    public_key = Column(LargeBinary, nullable=False)  # X25519 public key (32 bytes)
    private_key = Column(LargeBinary, nullable=False)  # X25519 private key (32 bytes) - encrypted at rest
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    used_at = Column(DateTime, nullable=True)

    identity = relationship("UserIdentityKey", back_populates="prekeys", lazy="selectin")
    sessions = relationship("Session", back_populates="prekey", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("identity_id", "prekey_id", name="uq_identity_prekey"),
        Index("ix_prekeys_identity_used", "identity_id", "used"),
    )


class UserSignedPreKey(Base):
    __tablename__ = "user_signed_prekeys"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    identity_id = Column(String, ForeignKey("user_identity_keys.id"), nullable=False, unique=True, index=True)
    prekey_id = Column(Integer, nullable=False)
    public_key = Column(LargeBinary, nullable=False)  # X25519 public key (32 bytes)
    private_key = Column(LargeBinary, nullable=False)  # X25519 private key (32 bytes) - encrypted at rest
    signature = Column(LargeBinary, nullable=False)  # Ed25519 signature of public_key by identity key
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True)  # Rotation policy

    identity = relationship("UserIdentityKey", back_populates="signed_prekey", lazy="selectin")
    sessions = relationship("Session", back_populates="signed_prekey", lazy="selectin")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    remote_user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    remote_device_id = Column(String, nullable=True)  # For multi-device support
    session_version = Column(Integer, default=3, nullable=False)  # Signal Protocol v3

    # Root ratchet state
    root_key = Column(LargeBinary, nullable=False)  # 32 bytes
    chain_key_sending = Column(LargeBinary, nullable=True)  # 32 bytes
    chain_key_receiving = Column(LargeBinary, nullable=True)  # 32 bytes

    # Ratchet state
    sender_ratchet_key_private = Column(LargeBinary, nullable=True)  # X25519
    sender_ratchet_key_public = Column(LargeBinary, nullable=True)  # X25519
    receiver_ratchet_key_public = Column(LargeBinary, nullable=True)  # X25519

    # Message counters
    sending_message_count = Column(Integer, default=0, nullable=False)
    receiving_message_count = Column(Integer, default=0, nullable=False)
    previous_chain_length = Column(Integer, default=0, nullable=False)

    # Associated keys
    prekey_id = Column(String, ForeignKey("user_prekeys.id"), nullable=True, index=True)
    signed_prekey_id = Column(String, ForeignKey("user_signed_prekeys.id"), nullable=True, index=True)

    # State
    established = Column(Boolean, default=False, nullable=False)
    archived = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_used_at = Column(DateTime, nullable=True)

    user = relationship("User", foreign_keys=[user_id], lazy="selectin")
    remote_user = relationship("User", foreign_keys=[remote_user_id], lazy="selectin")
    prekey = relationship("UserPreKey", back_populates="sessions", lazy="selectin")
    signed_prekey = relationship("UserSignedPreKey", back_populates="sessions", lazy="selectin")

    __table_args__ = (
        Index("ix_sessions_user_remote", "user_id", "remote_user_id", "remote_device_id"),
        Index("ix_sessions_established", "established", "archived"),
    )


class SafetyNumber(Base):
    __tablename__ = "safety_numbers"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    remote_user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    safety_number = Column(String, nullable=False)  # 60-digit safety number (5 groups of 12)
    verified = Column(Boolean, default=False, nullable=False)
    verified_at = Column(DateTime, nullable=True)
    verification_method = Column(String, nullable=True)  # "qr", "manual", "trusted_contact"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", foreign_keys=[user_id], lazy="selectin")
    remote_user = relationship("User", foreign_keys=[remote_user_id], lazy="selectin")

    __table_args__ = (
        UniqueConstraint("user_id", "remote_user_id", name="uq_safety_number_pair"),
    )


class EncryptedMessage(Base):
    __tablename__ = "encrypted_messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    message_id = Column(String, ForeignKey("messages.id"), nullable=False, unique=True, index=True)
    sender_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    recipient_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)

    # Signal Protocol encryption envelope
    ciphertext = Column(LargeBinary, nullable=False)  # Encrypted message body
    sender_ephemeral_public = Column(LargeBinary, nullable=False)  # X25519
    counter = Column(Integer, nullable=False)  # Message counter in session
    previous_counter = Column(Integer, nullable=True)  # For out-of-order delivery
    session_version = Column(Integer, default=3, nullable=False)

    # Metadata (unencrypted for routing)
    kind = Column(String, nullable=False)  # text, image, video, etc.
    has_attachment = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    delivered_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)

    sender = relationship("User", foreign_keys=[sender_id], lazy="selectin")
    recipient = relationship("User", foreign_keys=[recipient_id], lazy="selectin")

    __table_args__ = (
        Index("ix_encrypted_messages_recipient_created", "recipient_id", "created_at"),
    )