"""
E2E Encryption API Routes
Handles key distribution, session establishment, and safety number verification.
"""

import base64
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.e2e_encryption import (
    UserIdentityKey,
    UserPreKey,
    UserSignedPreKey,
    Session,
    SafetyNumber,
)
from ..services.e2e_encryption import (
    IdentityKeyPair,
    PreKeyRecord,
    SignedPreKeyRecord,
    compute_safety_number,
    verify_safety_number,
    serialize_signal_message,
    deserialize_signal_message,
    encrypt_at_rest,
    decrypt_at_rest,
)
from ..middleware.auth import get_current_user
from ..models.user import User


router = APIRouter(prefix="/e2e", tags=["E2E Encryption"])


# ============================================================
# Schemas
# ============================================================

class KeyPairSchema(BaseModel):
    public: str  # base64
    private: str  # base64 (only returned during generation)


class IdentityKeyResponse(BaseModel):
    identity_key_public: str
    signing_key_public: str
    registration_id: int


class PreKeyResponse(BaseModel):
    prekey_id: int
    public_key: str


class PreKeyBatchResponse(BaseModel):
    prekeys: List[PreKeyResponse]


class SignedPreKeyResponse(BaseModel):
    prekey_id: int
    public_key: str
    signature: str
    timestamp: int


class SessionInitRequest(BaseModel):
    recipient_id: str
    recipient_identity_key: str  # base64
    recipient_signed_prekey: SignedPreKeyResponse
    recipient_prekey: Optional[PreKeyResponse] = None


class SessionInitResponse(BaseModel):
    session_id: str
    initial_message: str  # base64 serialized Signal message


class SessionReceiveRequest(BaseModel):
    sender_id: str
    sender_identity_key: str
    message: str  # base64 serialized Signal message


class EncryptRequest(BaseModel):
    recipient_id: str
    plaintext: str  # base64 encoded


class EncryptResponse(BaseModel):
    ciphertext: str  # base64
    message: str  # base64 serialized Signal message


class DecryptRequest(BaseModel):
    sender_id: str
    message: str  # base64 serialized Signal message


class DecryptResponse(BaseModel):
    plaintext: str  # base64


class SafetyNumberRequest(BaseModel):
    remote_user_id: str
    remote_identity_key: str  # base64
    remote_registration_id: int


class SafetyNumberResponse(BaseModel):
    safety_number: str  # formatted 60-digit


class SafetyNumberVerifyRequest(BaseModel):
    remote_user_id: str
    remote_identity_key: str
    remote_registration_id: int
    displayed_number: str


class SafetyNumberVerifyResponse(BaseModel):
    verified: bool


class SafetyNumberStoreRequest(BaseModel):
    remote_user_id: str
    safety_number: str
    verified: bool = False
    verification_method: Optional[str] = None


# ============================================================
# Helpers
# ============================================================

def b64e(data: bytes) -> str:
    return base64.b64encode(data).decode()


def b64d(data: str) -> bytes:
    return base64.b64decode(data)


# ============================================================
# Identity Keys
# ============================================================

@router.get("/identity", response_model=IdentityKeyResponse)
async def get_my_identity(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's identity public keys."""
    identity = (
        await db.execute(
            select(UserIdentityKey).where(UserIdentityKey.user_id == current_user.id)
        )
    ).scalar_one_or_none()

    if not identity:
        # Generate new identity
        from ..services.e2e_encryption import generate_identity_key_pair
        keypair = generate_identity_key_pair()

        identity = UserIdentityKey(
            user_id=current_user.id,
            identity_key_public=keypair.identity_key.public,
            identity_key_private=encrypt_at_rest(keypair.identity_key.private),
            signing_key_public=keypair.signing_key.public,
            signing_key_private=encrypt_at_rest(keypair.signing_key.private),
            registration_id=keypair.registration_id,
        )
        db.add(identity)
        await db.commit()
        await db.refresh(identity)

    return IdentityKeyResponse(
        identity_key_public=b64e(identity.identity_key_public),
        signing_key_public=b64e(identity.signing_key_public),
        registration_id=identity.registration_id,
    )


@router.post("/identity/rotate", response_model=IdentityKeyResponse)
async def rotate_identity(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rotate identity keys (dangerous - breaks all existing sessions!)."""
    # Delete old identity and all associated keys/sessions
    identity_ids = (
        await db.execute(
            select(UserIdentityKey.id).where(UserIdentityKey.user_id == current_user.id)
        )
    ).scalars().all()

    if identity_ids:
        await db.execute(
            delete(UserPreKey).where(UserPreKey.identity_id.in_(identity_ids))
        )
        await db.execute(
            delete(UserSignedPreKey).where(UserSignedPreKey.identity_id.in_(identity_ids))
        )
    await db.execute(
        delete(Session).where(
            (Session.user_id == current_user.id) | (Session.remote_user_id == current_user.id)
        )
    )
    await db.execute(
        delete(UserIdentityKey).where(UserIdentityKey.user_id == current_user.id)
    )
    await db.commit()

    # Generate new
    from ..services.e2e_encryption import generate_identity_key_pair
    keypair = generate_identity_key_pair()

    identity = UserIdentityKey(
        user_id=current_user.id,
        identity_key_public=keypair.identity_key.public,
        identity_key_private=encrypt_at_rest(keypair.identity_key.private),
        signing_key_public=keypair.signing_key.public,
        signing_key_private=encrypt_at_rest(keypair.signing_key.private),
        registration_id=keypair.registration_id,
    )
    db.add(identity)
    await db.commit()
    await db.refresh(identity)

    return IdentityKeyResponse(
        identity_key_public=b64e(identity.identity_key_public),
        signing_key_public=b64e(identity.signing_key_public),
        registration_id=identity.registration_id,
    )


# ============================================================
# Prekeys
# ============================================================

@router.get("/prekeys", response_model=PreKeyBatchResponse)
async def get_prekeys(
    count: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get unused prekeys, generating more if needed."""
    identity = (
        await db.execute(
            select(UserIdentityKey).where(UserIdentityKey.user_id == current_user.id)
        )
    ).scalar_one_or_none()

    if not identity:
        raise HTTPException(status_code=404, detail="Identity not found. Call GET /e2e/identity first.")

    # Get unused prekeys
    unused = (
        await db.execute(
            select(UserPreKey)
            .where(
                UserPreKey.identity_id == identity.id,
                UserPreKey.used == False,
            )
            .limit(count)
        )
    ).scalars().all()

    if len(unused) < count:
        # Generate more
        from ..services.e2e_encryption import generate_prekeys
        existing_count = (
            await db.execute(
                select(func.count()).select_from(UserPreKey).where(
                    UserPreKey.identity_id == identity.id
                )
            )
        ).scalar_one()
        start_id = existing_count + 1
        new_prekeys = generate_prekeys(count - len(unused), start_id)

        for pk in new_prekeys:
            db_pk = UserPreKey(
                identity_id=identity.id,
                prekey_id=pk.prekey_id,
                public_key=pk.key_pair.public,
                private_key=encrypt_at_rest(pk.key_pair.private),
            )
            db.add(db_pk)
            unused.append(db_pk)

        await db.commit()

    return PreKeyBatchResponse(
        prekeys=[
            PreKeyResponse(prekey_id=pk.prekey_id, public_key=b64e(pk.public_key))
            for pk in unused[:count]
        ]
    )


@router.post("/prekeys/consume/{prekey_id}", response_model=PreKeyResponse)
async def consume_prekey(
    prekey_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a prekey as used (called by sender after building session)."""
    identity = (
        await db.execute(
            select(UserIdentityKey).where(UserIdentityKey.user_id == current_user.id)
        )
    ).scalar_one_or_none()

    if not identity:
        raise HTTPException(status_code=404, detail="Identity not found")

    prekey = (
        await db.execute(
            select(UserPreKey).where(
                UserPreKey.identity_id == identity.id,
                UserPreKey.prekey_id == prekey_id,
            )
        )
    ).scalar_one_or_none()

    if not prekey:
        raise HTTPException(status_code=404, detail="Prekey not found")

    if prekey.used:
        raise HTTPException(status_code=400, detail="Prekey already used")

    prekey.used = True
    prekey.used_at = datetime.utcnow()
    await db.commit()

    return PreKeyResponse(prekey_id=prekey.prekey_id, public_key=b64e(prekey.public_key))


# ============================================================
# Signed Prekey
# ============================================================

@router.get("/signed-prekey", response_model=SignedPreKeyResponse)
async def get_signed_prekey(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current signed prekey."""
    identity = (
        await db.execute(
            select(UserIdentityKey).where(UserIdentityKey.user_id == current_user.id)
        )
    ).scalar_one_or_none()

    if not identity:
        raise HTTPException(status_code=404, detail="Identity not found")

    spk = (
        await db.execute(
            select(UserSignedPreKey).where(UserSignedPreKey.identity_id == identity.id)
        )
    ).scalar_one_or_none()

    if not spk:
        # Generate new
        from ..services.e2e_encryption import generate_signed_prekey
        signing_key_private = decrypt_at_rest(identity.signing_key_private)
        new_spk = generate_signed_prekey(signing_key_private)

        spk = UserSignedPreKey(
            identity_id=identity.id,
            prekey_id=new_spk.prekey_id,
            public_key=new_spk.key_pair.public,
            private_key=encrypt_at_rest(new_spk.key_pair.private),
            signature=new_spk.signature,
        )
        db.add(spk)
        await db.commit()
        await db.refresh(spk)

    return SignedPreKeyResponse(
        prekey_id=spk.prekey_id,
        public_key=b64e(spk.public_key),
        signature=b64e(spk.signature),
        timestamp=int(spk.created_at.timestamp()),
    )


@router.post("/signed-prekey/rotate", response_model=SignedPreKeyResponse)
async def rotate_signed_prekey(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rotate signed prekey."""
    identity = (
        await db.execute(
            select(UserIdentityKey).where(UserIdentityKey.user_id == current_user.id)
        )
    ).scalar_one_or_none()

    if not identity:
        raise HTTPException(status_code=404, detail="Identity not found")

    # Delete old
    await db.execute(
        delete(UserSignedPreKey).where(UserSignedPreKey.identity_id == identity.id)
    )

    # Generate new
    from ..services.e2e_encryption import generate_signed_prekey
    signing_key_private = decrypt_at_rest(identity.signing_key_private)
    new_spk = generate_signed_prekey(signing_key_private)

    spk = UserSignedPreKey(
        identity_id=identity.id,
        prekey_id=new_spk.prekey_id,
        public_key=new_spk.key_pair.public,
        private_key=encrypt_at_rest(new_spk.key_pair.private),
        signature=new_spk.signature,
    )
    db.add(spk)
    await db.commit()
    await db.refresh(spk)

    return SignedPreKeyResponse(
        prekey_id=spk.prekey_id,
        public_key=b64e(spk.public_key),
        signature=b64e(spk.signature),
        timestamp=int(spk.created_at.timestamp()),
    )


# ============================================================
# Session Management
# ============================================================

@router.post("/session/initiate", response_model=SessionInitResponse)
async def initiate_session(
    request: SessionInitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Initiate a new E2E session as sender (X3DH)."""
    from ..services.e2e_encryption import (
        KeyPair,
        PreKeyRecord,
        build_sender_session,
    )

    # Get our identity
    our_identity_db = (
        await db.execute(
            select(UserIdentityKey).where(UserIdentityKey.user_id == current_user.id)
        )
    ).scalar_one_or_none()

    if not our_identity_db:
        raise HTTPException(status_code=404, detail="Identity not found")

    our_identity = IdentityKeyPair(
        identity_key=KeyPair(
            public=our_identity_db.identity_key_public,
            private=decrypt_at_rest(our_identity_db.identity_key_private),
        ),
        signing_key=KeyPair(
            public=our_identity_db.signing_key_public,
            private=decrypt_at_rest(our_identity_db.signing_key_private),
        ),
        registration_id=our_identity_db.registration_id,
    )

    # Parse recipient keys
    their_signed_prekey = SignedPreKeyRecord(
        prekey_id=request.recipient_signed_prekey.prekey_id,
        key_pair=KeyPair(
            public=b64d(request.recipient_signed_prekey.public_key),
            private=b"",  # Not needed for sender
        ),
        signature=b64d(request.recipient_signed_prekey.signature),
        timestamp=request.recipient_signed_prekey.timestamp,
    )

    their_prekey = None
    if request.recipient_prekey:
        their_prekey = PreKeyRecord(
            prekey_id=request.recipient_prekey.prekey_id,
            key_pair=KeyPair(
                public=b64d(request.recipient_prekey.public_key),
                private=b"",
            ),
        )

    # Build session
    session_state, initial_message = build_sender_session(
        our_identity,
        b64d(request.recipient_identity_key),
        their_signed_prekey,
        their_prekey,
    )

    # Store session
    session = Session(
        user_id=current_user.id,
        remote_user_id=request.recipient_id,
        session_version=session_state.session_version,
        local_identity_key_public=our_identity.identity_key.public,
        local_base_key_public=session_state.local_base_key.public,
        local_base_key_private=encrypt_at_rest(session_state.local_base_key.private),
        remote_identity_key=session_state.remote_identity_key,
        remote_base_key=session_state.remote_base_key,
        root_key=session_state.root_key,
        sender_chain_key=session_state.sender_chain_key,
        receiver_chain_key=session_state.receiver_chain_key,
        sender_ratchet_key_private=encrypt_at_rest(session_state.sender_ratchet_key.private) if session_state.sender_ratchet_key else None,
        sender_ratchet_key_public=session_state.sender_ratchet_key.public if session_state.sender_ratchet_key else None,
        receiver_ratchet_key_public=session_state.receiver_ratchet_key,
        established=True,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    # If prekey was used, mark it consumed on recipient side (would be done via separate API call)
    # For now, return the initial message
    return SessionInitResponse(
        session_id=session.id,
        initial_message=b64e(serialize_signal_message(initial_message)),
    )


@router.post("/session/receive", response_model=dict)
async def receive_session(
    request: SessionReceiveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Receive and process an initial session message (X3DH receiver)."""
    from ..services.e2e_encryption import (
        KeyPair,
        build_receiver_session,
    )

    # Get our identity
    our_identity_db = (
        await db.execute(
            select(UserIdentityKey).where(UserIdentityKey.user_id == current_user.id)
        )
    ).scalar_one_or_none()

    if not our_identity_db:
        raise HTTPException(status_code=404, detail="Identity not found")

    our_identity = IdentityKeyPair(
        identity_key=KeyPair(
            public=our_identity_db.identity_key_public,
            private=decrypt_at_rest(our_identity_db.identity_key_private),
        ),
        signing_key=KeyPair(
            public=our_identity_db.signing_key_public,
            private=decrypt_at_rest(our_identity_db.signing_key_private),
        ),
        registration_id=our_identity_db.registration_id,
    )

    # Get our signed prekey
    our_spk_db = (
        await db.execute(
            select(UserSignedPreKey).where(UserSignedPreKey.identity_id == our_identity_db.id)
        )
    ).scalar_one_or_none()

    if not our_spk_db:
        raise HTTPException(status_code=404, detail="Signed prekey not found")

    our_signed_prekey = SignedPreKeyRecord(
        prekey_id=our_spk_db.prekey_id,
        key_pair=KeyPair(
            public=our_spk_db.public_key,
            private=decrypt_at_rest(our_spk_db.private_key),
        ),
        signature=our_spk_db.signature,
        timestamp=int(our_spk_db.created_at.timestamp()),
    )

    # Find matching prekey if prekey message
    message = deserialize_signal_message(b64d(request.message))
    our_prekey = None
    if message.type == 2 and message.prekey_id:
        our_prekey_db = (
            await db.execute(
                select(UserPreKey).where(
                    UserPreKey.identity_id == our_identity_db.id,
                    UserPreKey.prekey_id == message.prekey_id,
                )
            )
        ).scalar_one_or_none()
        if our_prekey_db:
            our_prekey = PreKeyRecord(
                prekey_id=our_prekey_db.prekey_id,
                key_pair=KeyPair(
                    public=our_prekey_db.public_key,
                    private=decrypt_at_rest(our_prekey_db.private_key),
                ),
            )
            # Mark as used
            our_prekey_db.used = True
            our_prekey_db.used_at = datetime.utcnow()

    # Build receiver session
    session_state = build_receiver_session(
        our_identity,
        our_signed_prekey,
        our_prekey,
        b64d(request.sender_identity_key),
        message.base_key,
        message.message_version,
    )

    # Store session
    session = Session(
        user_id=current_user.id,
        remote_user_id=request.sender_id,
        session_version=session_state.session_version,
        local_identity_key_public=our_identity.identity_key.public,
        local_base_key_public=session_state.local_base_key.public,
        local_base_key_private=encrypt_at_rest(session_state.local_base_key.private),
        remote_identity_key=session_state.remote_identity_key,
        remote_base_key=session_state.remote_base_key,
        root_key=session_state.root_key,
        sender_chain_key=session_state.sender_chain_key,
        receiver_chain_key=session_state.receiver_chain_key,
        established=True,
    )
    db.add(session)
    await db.commit()

    return {"status": "session_established", "session_id": session.id}


# ============================================================
# Message Encryption/Decryption
# ============================================================

@router.post("/encrypt", response_model=EncryptResponse)
async def encrypt_message_endpoint(
    request: EncryptRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Encrypt a message for a recipient using existing session."""
    session = (
        await db.execute(
            select(Session).where(
                Session.user_id == current_user.id,
                Session.remote_user_id == request.recipient_id,
                Session.established == True,
                Session.archived == False,
            )
        )
    ).scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="No established session with recipient")

    # Reconstruct session state
    from ..services.e2e_encryption import SessionState, KeyPair, encrypt_message, decrypt_at_rest

    session_state = SessionState(
        session_version=session.session_version,
        local_identity_key=KeyPair(public=session.local_identity_key_public, private=b""),
        local_base_key=KeyPair(public=session.local_base_key_public, private=decrypt_at_rest(session.local_base_key_private) if session.local_base_key_private else b""),
        remote_identity_key=session.remote_identity_key,
        remote_base_key=session.remote_base_key,
        root_key=session.root_key,
        sender_chain_key=session.sender_chain_key,
        receiver_chain_key=session.receiver_chain_key,
        sender_ratchet_key=KeyPair(
            public=session.sender_ratchet_key_public or b"",
            private=decrypt_at_rest(session.sender_ratchet_key_private) if session.sender_ratchet_key_private else b""
        ) if session.sender_ratchet_key_public else None,
        receiver_ratchet_key=session.receiver_ratchet_key_public,
        sending_message_counter=session.sending_message_count,
        receiving_message_counter=session.receiving_message_count,
        previous_counter=session.previous_chain_length,
        has_sent_message=session.has_sent_message,
    )

    # Encrypt
    plaintext = b64d(request.plaintext)
    ciphertext, signal_msg = encrypt_message(session_state, plaintext)

    # Update session in DB
    session.root_key = session_state.root_key
    session.sender_chain_key = session_state.sender_chain_key
    session.receiver_chain_key = session_state.receiver_chain_key
    session.sender_ratchet_key_private = encrypt_at_rest(session_state.sender_ratchet_key.private) if session_state.sender_ratchet_key else None
    session.sender_ratchet_key_public = session_state.sender_ratchet_key.public if session_state.sender_ratchet_key else None
    session.receiver_ratchet_key_public = session_state.receiver_ratchet_key
    session.sending_message_count = session_state.sending_message_counter
    session.receiving_message_count = session_state.receiving_message_counter
    session.previous_chain_length = session_state.previous_counter
    session.last_used_at = datetime.utcnow()
    await db.commit()

    return EncryptResponse(
        ciphertext=b64e(ciphertext),
        message=b64e(serialize_signal_message(signal_msg)),
    )


@router.post("/decrypt", response_model=DecryptResponse)
async def decrypt_message_endpoint(
    request: DecryptRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Decrypt a message from a sender using existing session."""
    session = (
        await db.execute(
            select(Session).where(
                Session.user_id == current_user.id,
                Session.remote_user_id == request.sender_id,
                Session.established == True,
                Session.archived == False,
            )
        )
    ).scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="No established session with sender")

    from ..services.e2e_encryption import (
        SessionState,
        KeyPair,
        decrypt_message,
        deserialize_signal_message,
        ratchet_receive,
        decrypt_at_rest,
    )

    # Reconstruct session state
    session_state = SessionState(
        session_version=session.session_version,
        local_identity_key=KeyPair(public=session.local_identity_key_public, private=b""),
        local_base_key=KeyPair(public=session.local_base_key_public, private=decrypt_at_rest(session.local_base_key_private) if session.local_base_key_private else b""),
        remote_identity_key=session.remote_identity_key,
        remote_base_key=session.remote_base_key,
        root_key=session.root_key,
        sender_chain_key=session.sender_chain_key,
        receiver_chain_key=session.receiver_chain_key,
        sender_ratchet_key=KeyPair(
            public=session.sender_ratchet_key_public or b"",
            private=decrypt_at_rest(session.sender_ratchet_key_private) if session.sender_ratchet_key_private else b""
        ) if session.sender_ratchet_key_public else None,
        receiver_ratchet_key=session.receiver_ratchet_key_public,
        sending_message_counter=session.sending_message_count,
        receiving_message_counter=session.receiving_message_count,
        previous_counter=session.previous_chain_length,
        has_sent_message=session.has_sent_message,
    )

    # Parse message
    signal_msg = deserialize_signal_message(b64d(request.message))

    # Check for ratchet step
    if signal_msg.counter == 0 and session_state.receiver_ratchet_key != signal_msg.base_key:
        session_state = ratchet_receive(session_state, signal_msg.base_key)

    # Decrypt
    plaintext = decrypt_message(session_state, signal_msg)

    # Update session in DB
    session.root_key = session_state.root_key
    session.sender_chain_key = session_state.sender_chain_key
    session.receiver_chain_key = session_state.receiver_chain_key
    session.sender_ratchet_key_private = encrypt_at_rest(session_state.sender_ratchet_key.private) if session_state.sender_ratchet_key else None
    session.sender_ratchet_key_public = session_state.sender_ratchet_key.public if session_state.sender_ratchet_key else None
    session.receiver_ratchet_key_public = session_state.receiver_ratchet_key
    session.sending_message_count = session_state.sending_message_counter
    session.receiving_message_count = session_state.receiving_message_counter
    session.previous_chain_length = session_state.previous_counter
    session.last_used_at = datetime.utcnow()
    await db.commit()

    return DecryptResponse(plaintext=b64e(plaintext))


# ============================================================
# Safety Numbers
# ============================================================

@router.post("/safety-number/compute", response_model=SafetyNumberResponse)
async def compute_safety_number_endpoint(
    request: SafetyNumberRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Compute safety number with another user."""
    our_identity = (
        await db.execute(
            select(UserIdentityKey).where(UserIdentityKey.user_id == current_user.id)
        )
    ).scalar_one_or_none()

    if not our_identity:
        raise HTTPException(status_code=404, detail="Identity not found")

    safety_number = compute_safety_number(
        our_identity.identity_key_public,
        b64d(request.remote_identity_key),
        our_identity.registration_id,
        request.remote_registration_id,
    )

    return SafetyNumberResponse(safety_number=safety_number)


@router.post("/safety-number/verify", response_model=SafetyNumberVerifyResponse)
async def verify_safety_number_endpoint(
    request: SafetyNumberVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify a displayed safety number."""
    our_identity = (
        await db.execute(
            select(UserIdentityKey).where(UserIdentityKey.user_id == current_user.id)
        )
    ).scalar_one_or_none()

    if not our_identity:
        raise HTTPException(status_code=404, detail="Identity not found")

    verified = verify_safety_number(
        our_identity.identity_key_public,
        b64d(request.remote_identity_key),
        our_identity.registration_id,
        request.remote_registration_id,
        request.displayed_number,
    )

    return SafetyNumberVerifyResponse(verified=verified)


@router.post("/safety-number/store", response_model=dict)
async def store_safety_number(
    request: SafetyNumberStoreRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Store a verified safety number."""
    # Check if already exists
    existing = (
        await db.execute(
            select(SafetyNumber).where(
                SafetyNumber.user_id == current_user.id,
                SafetyNumber.remote_user_id == request.remote_user_id,
            )
        )
    ).scalar_one_or_none()

    if existing:
        existing.safety_number = request.safety_number
        existing.verified = request.verified
        existing.verification_method = request.verification_method
        existing.verified_at = datetime.utcnow() if request.verified else None
        existing.updated_at = datetime.utcnow()
    else:
        sn = SafetyNumber(
            user_id=current_user.id,
            remote_user_id=request.remote_user_id,
            safety_number=request.safety_number,
            verified=request.verified,
            verification_method=request.verification_method,
            verified_at=datetime.utcnow() if request.verified else None,
        )
        db.add(sn)

    await db.commit()
    return {"status": "stored"}


@router.get("/safety-number/{remote_user_id}", response_model=SafetyNumberResponse)
async def get_safety_number(
    remote_user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get stored safety number for a contact."""
    sn = (
        await db.execute(
            select(SafetyNumber).where(
                SafetyNumber.user_id == current_user.id,
                SafetyNumber.remote_user_id == remote_user_id,
            )
        )
    ).scalar_one_or_none()

    if not sn:
        raise HTTPException(status_code=404, detail="Safety number not found")

    return SafetyNumberResponse(safety_number=sn.safety_number)


# ============================================================
# Key Distribution (for other users to fetch)
# ============================================================

@router.get("/keys/{user_id}/identity", response_model=IdentityKeyResponse)
async def get_user_identity(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get another user's identity public keys (public endpoint)."""
    identity = (
        await db.execute(
            select(UserIdentityKey).where(UserIdentityKey.user_id == user_id)
        )
    ).scalar_one_or_none()

    if not identity:
        raise HTTPException(status_code=404, detail="User identity not found")

    return IdentityKeyResponse(
        identity_key_public=b64e(identity.identity_key_public),
        signing_key_public=b64e(identity.signing_key_public),
        registration_id=identity.registration_id,
    )


@router.get("/keys/{user_id}/signed-prekey", response_model=SignedPreKeyResponse)
async def get_user_signed_prekey(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get another user's signed prekey (public endpoint)."""
    identity = (
        await db.execute(
            select(UserIdentityKey).where(UserIdentityKey.user_id == user_id)
        )
    ).scalar_one_or_none()

    if not identity:
        raise HTTPException(status_code=404, detail="User identity not found")

    spk = (
        await db.execute(
            select(UserSignedPreKey).where(UserSignedPreKey.identity_id == identity.id)
        )
    ).scalar_one_or_none()

    if not spk:
        raise HTTPException(status_code=404, detail="Signed prekey not found")

    return SignedPreKeyResponse(
        prekey_id=spk.prekey_id,
        public_key=b64e(spk.public_key),
        signature=b64e(spk.signature),
        timestamp=int(spk.created_at.timestamp()),
    )


@router.get("/keys/{user_id}/prekeys", response_model=PreKeyBatchResponse)
async def get_user_prekeys(
    user_id: str,
    count: int = 1,
    db: AsyncSession = Depends(get_db),
):
    """Get another user's prekeys (public endpoint)."""
    identity = (
        await db.execute(
            select(UserIdentityKey).where(UserIdentityKey.user_id == user_id)
        )
    ).scalar_one_or_none()

    if not identity:
        raise HTTPException(status_code=404, detail="User identity not found")

    prekeys = (
        await db.execute(
            select(UserPreKey).where(
                UserPreKey.identity_id == identity.id,
                UserPreKey.used == False,
            ).limit(count)
        )
    ).scalars().all()

    if not prekeys:
        raise HTTPException(status_code=404, detail="No prekeys available")

    return PreKeyBatchResponse(
        prekeys=[
            PreKeyResponse(prekey_id=pk.prekey_id, public_key=b64e(pk.public_key))
            for pk in prekeys
        ]
    )