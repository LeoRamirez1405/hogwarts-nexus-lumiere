"""Session management endpoints."""
import base64
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...models.e2e_encryption import Session, UserIdentityKey, UserPreKey
from ...middleware.auth import get_current_user
from ...models.user import User
from ...services.e2e import (
    E2EEncryptionService,
    PreKeyRecord,
    SignedPreKeyRecord,
    KeyPair,
    decrypt_at_rest,
    serialize_signal_message,
    deserialize_signal_message,
)
from ...utils.dates import utcnow

router = APIRouter()


def b64e(data: bytes) -> str:
    return base64.b64encode(data).decode()


def b64d(data: str) -> bytes:
    return base64.b64decode(data)


class SessionInitRequest(BaseModel):
    recipient_id: str
    recipient_identity_key: str
    recipient_signing_key: Optional[str] = None
    recipient_signed_prekey: dict
    recipient_prekey: Optional[dict] = None


class SessionInitResponse(BaseModel):
    session_id: str
    initial_message: str


class SessionReceiveRequest(BaseModel):
    sender_id: str
    sender_identity_key: str
    message: str


@router.post("/session/initiate", response_model=SessionInitResponse)
async def initiate_session(
    request: SessionInitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Initiate a new E2E session as sender (X3DH)."""
    service = E2EEncryptionService(db, current_user.id)

    their_signed_prekey = SignedPreKeyRecord(
        prekey_id=request.recipient_signed_prekey["prekey_id"],
        key_pair=KeyPair(
            public=b64d(request.recipient_signed_prekey["public_key"]),
            private=b"",
        ),
        signature=b64d(request.recipient_signed_prekey["signature"]),
        timestamp=request.recipient_signed_prekey["timestamp"],
    )

    their_prekey = None
    if request.recipient_prekey:
        their_prekey = PreKeyRecord(
            prekey_id=request.recipient_prekey["prekey_id"],
            key_pair=KeyPair(
                public=b64d(request.recipient_prekey["public_key"]),
                private=b"",
            ),
        )

    session_state = await service.build_session_as_sender(
        request.recipient_id,
        b64d(request.recipient_identity_key),
        their_signed_prekey,
        their_prekey,
        b64d(request.recipient_signing_key) if request.recipient_signing_key else None,
    )

    session = (
        await db.execute(
            select(Session).where(
                Session.user_id == current_user.id,
                Session.remote_user_id == request.recipient_id,
            )
        )
    ).scalar_one()

    return SessionInitResponse(
        session_id=session.id,
        initial_message=b64e(serialize_signal_message(session_state)),
    )


@router.post("/session/receive", response_model=dict)
async def receive_session(
    request: SessionReceiveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Receive and process an initial session message (X3DH receiver)."""
    service = E2EEncryptionService(db, current_user.id)

    message = deserialize_signal_message(b64d(request.message))

    our_prekey = None
    if message.type == 2 and message.prekey_id:
        identity_db = (
            await db.execute(
                select(UserIdentityKey).where(UserIdentityKey.user_id == current_user.id)
            )
        ).scalar_one_or_none()

        if identity_db:
            prekey_db = (
                await db.execute(
                    select(UserPreKey).where(
                        UserPreKey.identity_id == identity_db.id,
                        UserPreKey.prekey_id == message.prekey_id,
                    )
                )
            ).scalar_one_or_none()

            if prekey_db:
                our_prekey = PreKeyRecord(
                    prekey_id=prekey_db.prekey_id,
                    key_pair=KeyPair(
                        public=prekey_db.public_key,
                        private=decrypt_at_rest(prekey_db.private_key),
                    ),
                )
                prekey_db.used = True
                prekey_db.used_at = utcnow()

    await service.build_session_as_receiver(
        request.sender_id,
        b64d(request.sender_identity_key),
        message.base_key,
        message.type,
        our_prekey,
    )

    session = (
        await db.execute(
            select(Session).where(
                Session.user_id == current_user.id,
                Session.remote_user_id == request.sender_id,
            )
        )
    ).scalar_one()

    return {"status": "session_established", "session_id": session.id}