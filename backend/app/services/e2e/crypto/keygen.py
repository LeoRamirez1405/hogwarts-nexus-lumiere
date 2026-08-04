"""Key generation helpers."""
import secrets
from typing import List
from datetime import datetime

from .primitives import (
    generate_x25519_keypair,
    generate_ed25519_keypair,
    ed25519_sign,
)
from .keys import IdentityKeyPair, KeyPair, PreKeyRecord, SignedPreKeyRecord


def generate_identity_key_pair() -> IdentityKeyPair:
    """Generate a new identity key pair with registration ID."""
    identity_keypair = generate_x25519_keypair()
    signing_keypair = generate_ed25519_keypair()
    registration_id = secrets.randbelow(16380) + 1
    return IdentityKeyPair(
        identity_key=KeyPair(public=identity_keypair[0], private=identity_keypair[1]),
        signing_key=KeyPair(public=signing_keypair[0], private=signing_keypair[1]),
        registration_id=registration_id,
    )


def generate_prekeys(count: int = 100, start_id: int = 1) -> List[PreKeyRecord]:
    """Generate a batch of prekeys."""
    prekeys = []
    for i in range(count):
        key_pair = generate_x25519_keypair()
        prekeys.append(
            PreKeyRecord(
                prekey_id=start_id + i,
                key_pair=KeyPair(public=key_pair[0], private=key_pair[1]),
            )
        )
    return prekeys


def generate_signed_prekey(identity_signing_key: bytes, prekey_id: int = 1) -> SignedPreKeyRecord:
    """Generate a signed prekey."""
    key_pair = generate_x25519_keypair()
    signature = ed25519_sign(identity_signing_key, key_pair[0])
    return SignedPreKeyRecord(
        prekey_id=prekey_id,
        key_pair=KeyPair(public=key_pair[0], private=key_pair[1]),
        signature=signature,
        timestamp=int(datetime.utcnow().timestamp()),
    )