"""Session manager for loading/saving sessions from database."""
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..crypto.primitives import encrypt_at_rest, decrypt_at_rest
from ..crypto.keys import SessionState, KeyPair
from ....models.e2e_encryption import Session as SessionModel


class SessionManager:
    """Manages session persistence to/from database."""

    def __init__(self, db: AsyncSession, user_id: str):
        self.db = db
        self.user_id = user_id

    async def save(self, remote_user_id: str, session_state: SessionState) -> SessionModel:
        """Save session state to database."""
        session = (
            await self.db.execute(
                select(SessionModel).where(
                    SessionModel.user_id == self.user_id,
                    SessionModel.remote_user_id == remote_user_id,
                )
            )
        ).scalar_one_or_none()

        if not session:
            session = SessionModel(
                user_id=self.user_id,
                remote_user_id=remote_user_id,
            )
            self.db.add(session)

        session.session_version = session_state.session_version
        session.local_identity_key_public = session_state.local_identity_key.public
        session.local_base_key_public = session_state.local_base_key.public
        session.local_base_key_private = encrypt_at_rest(session_state.local_base_key.private)
        session.remote_identity_key = session_state.remote_identity_key
        session.remote_base_key = session_state.remote_base_key
        session.root_key = session_state.root_key
        session.sender_chain_key = session_state.sender_chain_key
        session.receiver_chain_key = session_state.receiver_chain_key
        session.sender_ratchet_key_private = (
            encrypt_at_rest(session_state.sender_ratchet_key.private)
            if session_state.sender_ratchet_key else None
        )
        session.sender_ratchet_key_public = (
            session_state.sender_ratchet_key.public
            if session_state.sender_ratchet_key else None
        )
        session.receiver_ratchet_key_public = session_state.receiver_ratchet_key
        session.sending_message_count = session_state.sending_message_counter
        session.receiving_message_count = session_state.receiving_message_counter
        session.previous_chain_length = session_state.previous_counter
        session.has_sent_message = session_state.has_sent_message
        session.established = True

        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def load(self, remote_user_id: str) -> Optional[SessionState]:
        """Load session state from database."""
        session = (
            await self.db.execute(
                select(SessionModel).where(
                    SessionModel.user_id == self.user_id,
                    SessionModel.remote_user_id == remote_user_id,
                    SessionModel.established,
                    not SessionModel.archived,
                )
            )
        ).scalar_one_or_none()

        if not session:
            return None

        return self._reconstruct_session_state(session)

    def _reconstruct_session_state(self, session: SessionModel) -> SessionState:
        """Reconstruct SessionState from database model."""
        sender_ratchet_key = None
        if session.sender_ratchet_key_public:
            sender_ratchet_key = KeyPair(
                public=session.sender_ratchet_key_public,
                private=decrypt_at_rest(session.sender_ratchet_key_private)
                if session.sender_ratchet_key_private else b""
            )

        return SessionState(
            session_version=session.session_version,
            local_identity_key=KeyPair(
                public=session.local_identity_key_public,
                private=b""  # Private key not stored in session
            ),
            local_base_key=KeyPair(
                public=session.local_base_key_public,
                private=decrypt_at_rest(session.local_base_key_private)
                if session.local_base_key_private else b""
            ),
            remote_identity_key=session.remote_identity_key,
            remote_base_key=session.remote_base_key,
            root_key=session.root_key,
            sender_chain_key=session.sender_chain_key,
            receiver_chain_key=session.receiver_chain_key,
            sender_ratchet_key=sender_ratchet_key,
            receiver_ratchet_key=session.receiver_ratchet_key_public,
            sending_message_counter=session.sending_message_count,
            receiving_message_counter=session.receiving_message_count,
            previous_counter=session.previous_chain_length,
            has_sent_message=session.has_sent_message,
        )

    async def delete(self, remote_user_id: str) -> bool:
        """Delete a session."""
        session = (
            await self.db.execute(
                select(SessionModel).where(
                    SessionModel.user_id == self.user_id,
                    SessionModel.remote_user_id == remote_user_id,
                )
            )
        ).scalar_one_or_none()

        if session:
            await self.db.delete(session)
            await self.db.commit()
            return True
        return False

    async def archive(self, remote_user_id: str) -> bool:
        """Archive a session."""
        session = (
            await self.db.execute(
                select(SessionModel).where(
                    SessionModel.user_id == self.user_id,
                    SessionModel.remote_user_id == remote_user_id,
                )
            )
        ).scalar_one_or_none()

        if session:
            session.archived = True
            await self.db.commit()
            return True
        return False