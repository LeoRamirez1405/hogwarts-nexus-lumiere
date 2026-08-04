"""X3DH receiver session building."""
from typing import Optional
from ..crypto.primitives import (
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
)


def build_receiver_session(
    our_identity: IdentityKeyPair,
    our_signed_prekey: SignedPreKeyRecord,
    our_prekey: Optional[PreKeyRecord],
    their_identity_public: bytes,
    their_base_key: bytes,
    message_type: int,
) -> SessionState:
    """Build a session as receiver (X3DH key agreement)."""
    if message_type == 2:
        if not our_prekey:
            raise ValueError("Prekey message received but no prekey available")
        used_prekey = our_prekey
    else:
        used_prekey = None

    # Match sender order: DH1=DH(SPKb,IKa) DH2=DH(IKb,EKa) DH3=DH(SPKb,EKa) DH4=DH(OPKb,EKa)
    dh1 = x25519_agree(our_signed_prekey.key_pair.private, their_identity_public)
    dh2 = x25519_agree(our_identity.identity_key.private, their_base_key)
    dh3 = x25519_agree(our_signed_prekey.key_pair.private, their_base_key)

    dh4 = b""
    if used_prekey:
        dh4 = x25519_agree(used_prekey.key_pair.private, their_base_key)

    master_secret = dh1 + dh2 + dh3 + dh4
    if used_prekey is None:
        master_secret += b"\x00" * CURVE25519_KEY_SIZE

    root_key = hkdf(master_secret, b"", ROOT_KEY_SEED, AES256_KEY_SIZE)

    _, receiver_chain_key = kdf_root(root_key, b"")
    _, sender_chain_key = kdf_root(root_key, b"")

    return SessionState(
        local_identity_key=our_identity.identity_key,
        local_base_key=our_signed_prekey.key_pair,
        remote_identity_key=their_identity_public,
        remote_base_key=their_base_key,
        root_key=root_key,
        sender_chain_key=sender_chain_key,
        receiver_chain_key=receiver_chain_key,
        has_sent_message=False,
    )