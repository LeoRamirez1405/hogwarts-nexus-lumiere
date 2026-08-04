"""X3DH primitives."""
from ..crypto.primitives import ed25519_verify
from ..crypto.keys import SignedPreKeyRecord


def verify_signed_prekey(identity_public_key: bytes, signed_prekey: SignedPreKeyRecord) -> bool:
    """Verify a signed prekey signature."""
    return ed25519_verify(identity_public_key, signed_prekey.signature, signed_prekey.key_pair.public)