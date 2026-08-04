"""E2E Encryption Service Package."""
from .crypto import (
    generate_x25519_keypair,
    generate_ed25519_keypair,
    x25519_agree,
    ed25519_sign,
    ed25519_verify,
    hkdf,
    hmac_sha256,
    aes256_gcm_encrypt,
    aes256_gcm_decrypt,
    derive_message_keys,
    kdf_root,
    kdf_chain,
    encrypt_at_rest,
    decrypt_at_rest,
)
from .crypto.keygen import generate_identity_key_pair, generate_prekeys, generate_signed_prekey
from .crypto.keys import (
    KeyPair,
    IdentityKeyPair,
    PreKeyRecord,
    SignedPreKeyRecord,
    MessageKeys,
    SignalMessage,
    SessionState,
)
from .crypto.safety_numbers import compute_safety_number, verify_safety_number
from .x3dh import (
    build_sender_session,
    build_receiver_session,
    verify_signed_prekey,
)
from .ratchet import ratchet_initialize, ratchet_receive
from .session import (
    SessionManager,
    serialize_signal_message,
    deserialize_signal_message,
)
from .encryption import encrypt_message, decrypt_message
from .key_manager import KeyManager
from .service import E2EEncryptionService

__all__ = [
    "generate_x25519_keypair",
    "generate_ed25519_keypair",
    "x25519_agree",
    "ed25519_sign",
    "ed25519_verify",
    "hkdf",
    "hmac_sha256",
    "aes256_gcm_encrypt",
    "aes256_gcm_decrypt",
    "derive_message_keys",
    "kdf_root",
    "kdf_chain",
    "encrypt_at_rest",
    "decrypt_at_rest",
    "generate_identity_key_pair",
    "generate_prekeys",
    "generate_signed_prekey",
    "KeyPair",
    "IdentityKeyPair",
    "PreKeyRecord",
    "SignedPreKeyRecord",
    "MessageKeys",
    "SignalMessage",
    "SessionState",
    "compute_safety_number",
    "verify_safety_number",
    "build_sender_session",
    "build_receiver_session",
    "verify_signed_prekey",
    "ratchet_initialize",
    "ratchet_receive",
    "SessionManager",
    "serialize_signal_message",
    "deserialize_signal_message",
    "encrypt_message",
    "decrypt_message",
    "KeyManager",
    "E2EEncryptionService",
]