"""High-level E2E encryption service."""
from typing import Optional, List, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .crypto.keys import (
    IdentityKeyPair,
    PreKeyRecord,
    SignedPreKeyRecord,
    SessionState,
    SignalMessage,
)
from .crypto.safety_numbers import compute_safety_number, verify_safety_number
from .x3dh import build_sender_session, build_receiver_session
from .encryption import encrypt_message, decrypt_message
from .session.manager import SessionManager
from .key_manager import KeyManager
from .ratchet.receiver import ratchet_receive
from ...models.e2e_encryption import SafetyNumber
from app.utils.dates import utcnow


class E2EEncryptionService:
    """High-level service for E2E encryption operations."""

    def __init__(self, db: AsyncSession, user_id: str):
        self.db = db
        self.user_id = user_id
        self._identity: Optional[IdentityKeyPair] = None
        self._key_manager = KeyManager(db, user_id)
        self._session_manager = SessionManager(db, user_id)

    # ---- Identity Management ----

    async def ensure_identity(self) -> IdentityKeyPair:
        """Ensure user has an identity key pair, create if missing."""
        if self._identity is None:
            self._identity = await self._key_manager.load_or_create_identity()
        return self._identity

    async def get_identity_public(self) -> bytes:
        identity = await self.ensure_identity()
        return identity.identity_key.public

    async def get_registration_id(self) -> int:
        identity = await self.ensure_identity()
        return identity.registration_id

    async def rotate_identity(self) -> IdentityKeyPair:
        """Rotate identity keys (dangerous - breaks all existing sessions!)."""
        self._identity = await self._key_manager.rotate_identity()
        return self._identity

    # ---- Prekey Management ----

    async def generate_prekeys(self, count: int = 100) -> List[PreKeyRecord]:
        """Generate and store prekeys."""
        await self.ensure_identity()
        return await self._key_manager.generate_prekeys(count)

    async def get_unused_prekeys(self, count: int = 50) -> List[PreKeyRecord]:
        """Get unused prekeys from database."""
        await self.ensure_identity()
        return await self._key_manager.get_unused_prekeys(count)

    async def consume_prekey(self, prekey_id: int) -> Optional[PreKeyRecord]:
        """Mark a prekey as used."""
        await self.ensure_identity()
        return await self._key_manager.consume_prekey(prekey_id)

    async def get_signed_prekey(self) -> Optional[SignedPreKeyRecord]:
        """Get current signed prekey."""
        await self.ensure_identity()
        return await self._key_manager.get_signed_prekey()

    async def generate_signed_prekey(self) -> SignedPreKeyRecord:
        """Generate and store a signed prekey."""
        await self.ensure_identity()
        return await self._key_manager.generate_signed_prekey()

    async def rotate_signed_prekey(self) -> SignedPreKeyRecord:
        """Rotate signed prekey."""
        await self.ensure_identity()
        return await self._key_manager.rotate_signed_prekey()

    # ---- Session Management ----

    async def build_session_as_sender(
        self,
        their_user_id: str,
        their_identity_public: bytes,
        their_signed_prekey: SignedPreKeyRecord,
        their_prekey: Optional[PreKeyRecord] = None,
        their_signing_key_public: Optional[bytes] = None,
    ) -> SessionState:
        """Build a new session as sender."""
        our_identity = await self.ensure_identity()
        session_state, _initial_message = build_sender_session(
            our_identity,
            their_identity_public,
            their_signed_prekey,
            their_prekey,
            their_signing_key_public,
        )
        await self._session_manager.save(their_user_id, session_state)
        return session_state

    async def build_session_as_receiver(
        self,
        their_user_id: str,
        their_identity_public: bytes,
        their_base_key: bytes,
        message_type: int,
        our_prekey: Optional[PreKeyRecord] = None,
    ) -> SessionState:
        """Build a new session as receiver."""
        our_identity = await self.ensure_identity()
        our_signed_prekey = await self.get_signed_prekey()

        if not our_signed_prekey:
            raise ValueError("No signed prekey available")

        session_state = build_receiver_session(
            our_identity, our_signed_prekey, our_prekey,
            their_identity_public, their_base_key, message_type
        )
        await self._session_manager.save(their_user_id, session_state)
        return session_state

    async def get_session(self, their_user_id: str) -> Optional[SessionState]:
        """Get existing session."""
        return await self._session_manager.load(their_user_id)

    async def save_session(self, their_user_id: str, session_state: SessionState) -> None:
        """Persist session state."""
        await self._session_manager.save(their_user_id, session_state)

    async def encrypt(self, their_user_id: str, plaintext: bytes) -> Tuple[bytes, SignalMessage]:
        """Encrypt a message for a recipient."""
        session = await self.get_session(their_user_id)
        if not session:
            raise ValueError(f"No session with {their_user_id}")
        ciphertext, message = encrypt_message(session, plaintext)
        await self._session_manager.save(their_user_id, session)
        return ciphertext, message

    async def decrypt(self, their_user_id: str, signal_message: SignalMessage) -> bytes:
        """Decrypt a message from a sender."""
        session = await self.get_session(their_user_id)
        if not session:
            raise ValueError(f"No session with {their_user_id}")

        if signal_message.counter == 0 and session.receiver_ratchet_key != signal_message.base_key:
            session = ratchet_receive(session, signal_message.base_key)

        plaintext = decrypt_message(session, signal_message)
        await self._session_manager.save(their_user_id, session)
        return plaintext

    # ---- Safety Numbers ----

    async def compute_safety_number(
        self,
        their_identity_public: bytes,
        their_registration: int,
    ) -> str:
        """Compute safety number with another user."""
        our_identity = await self.ensure_identity()
        our_reg = await self.get_registration_id()

        return compute_safety_number(
            our_identity.identity_key.public,
            their_identity_public,
            our_reg,
            their_registration
        )

    async def verify_safety_number(
        self,
        their_identity_public: bytes,
        their_registration: int,
        displayed_number: str,
    ) -> bool:
        """Verify a safety number."""
        our_identity = await self.ensure_identity()
        our_reg = await self.get_registration_id()

        return verify_safety_number(
            our_identity.identity_key.public,
            their_identity_public,
            our_reg,
            their_registration,
            displayed_number
        )

    async def store_safety_number(
        self,
        remote_user_id: str,
        safety_number: str,
        verified: bool = False,
        verification_method: Optional[str] = None,
    ) -> None:
        """Store a verified safety number."""
        existing = (
            await self.db.execute(
                select(SafetyNumber).where(
                    SafetyNumber.user_id == self.user_id,
                    SafetyNumber.remote_user_id == remote_user_id,
                )
            )
        ).scalar_one_or_none()

        if existing:
            existing.safety_number = safety_number
            existing.verified = verified
            existing.verification_method = verification_method
            existing.verified_at = utcnow() if verified else None
            existing.updated_at = utcnow()
        else:
            sn = SafetyNumber(
                user_id=self.user_id,
                remote_user_id=remote_user_id,
                safety_number=safety_number,
                verified=verified,
                verification_method=verification_method,
                verified_at=utcnow() if verified else None,
            )
            self.db.add(sn)

        await self.db.commit()

    async def get_safety_number(self, remote_user_id: str) -> Optional[str]:
        """Get stored safety number for a contact."""
        sn = (
            await self.db.execute(
                select(SafetyNumber).where(
                    SafetyNumber.user_id == self.user_id,
                    SafetyNumber.remote_user_id == remote_user_id,
                )
            )
        ).scalar_one_or_none()

        return sn.safety_number if sn else None