"""X3DH sender session building."""
from typing import Optional, Tuple
from ..crypto.primitives import (
    generate_x25519_keypair,
    x25519_agree,
    hkdf,
    kdf_root,
    ROOT_KEY_SEED,
    AES256_KEY_SIZE,
    CURVE25519_KEY_SIZE,
)
from ..crypto.keys import (
    IdentityKeyPair,
    PreKeyRecord,
    SignedPreKeyRecord,
    SessionState,
    SignalMessage,
    KeyPair,
)
from .primitives import verify_signed_prekey


SIGNAL_PROTOCOL_VERSION = 3
SESSION_VERSION = 3


def build_sender_session(
    our_identity: IdentityKeyPair,
    their_identity_public: bytes,
    their_signed_prekey: SignedPreKeyRecord,
    their_prekey: Optional[PreKeyRecord] = None,
    their_signing_key_public: Optional[bytes] = None,
) -> Tuple[SessionState, SignalMessage]:
    """Build a session as sender (X3DH key agreement)."""
    base_key = generate_x25519_keypair()

    if their_signing_key_public:
        if not verify_signed_prekey(their_signing_key_public, their_signed_prekey):
            raise ValueError("Invalid signed prekey signature")

    dh1 = x25519_agree(our_identity.identity_key.private, their_signed_prekey.key_pair.public)
    dh2 = x25519_agree(base_key[1], their_identity_public)
    dh3 = x25519_agree(base_key[1], their_signed_prekey.key_pair.public)

    dh4 = b""
    if their_prekey:
        dh4 = x25519_agree(base_key[1], their_prekey.key_pair.public)

    master_secret = dh1 + dh2 + dh3 + dh4
    if their_prekey is None:
        master_secret += b"\x00" * CURVE25519_KEY_SIZE

    root_key = hkdf(master_secret, b"", ROOT_KEY_SEED, AES256_KEY_SIZE)

    _, sender_chain_key = kdf_root(root_key, b"")
    _, receiver_chain_key = kdf_root(root_key, b"")

    session = SessionState(
        local_identity_key=our_identity.identity_key,
        local_base_key=KeyPair(public=base_key[0], private=base_key[1]),
        remote_identity_key=their_identity_public,
        remote_base_key=their_signed_prekey.key_pair.public,
        root_key=root_key,
        sender_chain_key=sender_chain_key,
        receiver_chain_key=receiver_chain_key,
    )

    message = SignalMessage(
        version=SIGNAL_PROTOCOL_VERSION,
        type=2 if their_prekey else 3,
        prekey_id=their_prekey.prekey_id if their_prekey else None,
        signed_prekey_id=their_signed_prekey.prekey_id,
        base_key=base_key[0],
        identity_key=our_identity.identity_key.public,
        message_version=SESSION_VERSION,
        counter=0,
        ciphertext=b"",
        mac=b"",
    )

    return session, message